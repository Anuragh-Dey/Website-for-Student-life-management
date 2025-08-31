const bcrypt = require('bcrypt');
const EmergencyFund = require('../models/emergencyModel');
const FundTx = require('../models/fundTransactionModel');

// Try to require Expense model if you have one (optional)
let Expense = null;
try { Expense = require('../models/Expense'); } catch (_) { /* optional */ }

// ---------- user resolver (NO AUTH) ----------
async function resolveUser(req) {
  const User = require('../models/userModel'); // your existing user model
  const emailFromHeader = (req.header('x-user-email') || '').toLowerCase().trim();
  const email = emailFromHeader || (process.env.DEV_USER_EMAIL || 'dev@example.com').toLowerCase();

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: 'Dev User',
      username: `dev_${Date.now()}`,
      email,
      password: 'devpass123',           // hashed by pre-save hook
      firstLoginVerified: true
    });
  }
  return user;
}

// ---------- helpers ----------
function monthDiff(from, to) {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24 * 30)));
}
function safetyBand(pct) {
  if (pct >= 1) return 'secure';
  if (pct >= 0.5) return 'steady';
  return 'seedling';
}
function addBadge(badges, b) { if (!badges.includes(b)) badges.push(b); }

async function computeAvgEssentialMonthly(userId, months = 3) {
  if (!Expense) return null;
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const pipeline = [
    { $match: { user: userId, date: { $gte: from }, essential: true } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ];
  const res = await Expense.aggregate(pipeline);
  const total = res[0]?.total || 0;
  return total / months || 0;
}

// ---------- controllers ----------
exports.setup = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const { method, targetMonths, targetAmount, targetDate } = req.body;

    let goalAmount = 0;
    let monthsPlan = 0;

    if (method === 'months') {
      const months = Number(targetMonths || 3);
      const avg = await computeAvgEssentialMonthly(user._id, 3);
      if (!avg) return res.status(400).json({ message: 'Cannot infer essential expenses. Use method="amount".' });
      goalAmount = Math.round(avg * months);
      monthsPlan = months;
    } else if (method === 'amount') {
      goalAmount = Number(targetAmount || 0);
    } else {
      return res.status(400).json({ message: 'method must be "months" or "amount".' });
    }

    let fund = await EmergencyFund.findOne({ user: user._id });
    if (!fund) fund = new EmergencyFund({ user: user._id });

    fund.targetAmount = goalAmount;
    fund.targetMonths = monthsPlan || fund.targetMonths || 0;
    fund.targetDate = targetDate ? new Date(targetDate) : fund.targetDate;

    // monthly plan
    const remaining = Math.max(0, goalAmount - fund.currentBalance);
    if (fund.targetDate) {
      const monthsLeft = monthDiff(new Date(), new Date(fund.targetDate));
      fund.monthlyPlan = Math.ceil(remaining / monthsLeft);
    } else {
      fund.monthlyPlan = Math.ceil(remaining / Math.max(1, fund.targetMonths || 6));
    }

    await fund.save();
    return res.status(200).json({ message: 'Emergency fund configured', fund });
  } catch (e) {
    console.error('setup fund error', e);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const fund = await EmergencyFund.findOne({ user: user._id });
    if (!fund) return res.status(404).json({ message: 'No emergency fund set up yet.' });

    const pct = fund.targetAmount > 0 ? fund.currentBalance / fund.targetAmount : 0;
    const band = safetyBand(pct);
    const milestones = [0.10, 0.25, 0.50, 0.75, 1.00];
    const nextMs = milestones.find(m => pct < m) || 1.00;
    const nextAmount = Math.ceil((fund.targetAmount * nextMs) - fund.currentBalance);

    return res.status(200).json({
      fund,
      progress: {
        percent: Number((pct * 100).toFixed(2)),
        band,
        nextMilestonePct: nextMs * 100,
        nextMilestoneNeeded: Math.max(0, nextAmount)
      }
    });
  } catch (e) {
    console.error('summary error', e);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.addContribution = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const { amount, note } = req.body;
    const val = Number(amount || 0);
    if (val <= 0) return res.status(400).json({ message: 'Amount must be > 0' });

    const fund = await EmergencyFund.findOne({ user: user._id });
    if (!fund) return res.status(404).json({ message: 'No emergency fund set up yet.' });

    fund.currentBalance += val;

    // streak per calendar month
    const now = new Date();
    const last = fund.lastContributionAt;
    const newMonth = !last || (last.getUTCFullYear() !== now.getUTCFullYear() || last.getUTCMonth() !== now.getUTCMonth());
    if (newMonth) fund.streakCount += 1;
    fund.lastContributionAt = now;

    // badges
    const pct = fund.targetAmount > 0 ? fund.currentBalance / fund.targetAmount : 0;
    if (pct >= 0.1) addBadge(fund.badges, '10%');
    if (pct >= 0.25) addBadge(fund.badges, '25%');
    if (pct >= 0.5) addBadge(fund.badges, '50%');
    if (pct >= 0.75) addBadge(fund.badges, '75%');
    if (pct >= 1.0) addBadge(fund.badges, '100%');
    if (fund.targetMonths >= 3 && pct >= (3 / (fund.targetMonths || 3))) addBadge(fund.badges, '3mo');
    if (fund.targetMonths >= 6 && pct >= (6 / fund.targetMonths)) addBadge(fund.badges, '6mo');
    if (fund.targetMonths >= 12 && pct >= (12 / fund.targetMonths)) addBadge(fund.badges, '12mo');
    if (fund.streakCount >= 3) addBadge(fund.badges, 'Streak3');
    if (fund.streakCount >= 6) addBadge(fund.badges, 'Streak6');
    if (fund.streakCount >= 12) addBadge(fund.badges, 'Streak12');

    // recompute plan
    if (fund.targetDate) {
      const remaining = Math.max(0, fund.targetAmount - fund.currentBalance);
      fund.monthlyPlan = Math.ceil(remaining / monthDiff(new Date(), new Date(fund.targetDate)));
    }

    await fund.save();
    const tx = await FundTx.create({ user: user._id, fund: fund._id, type: 'deposit', amount: val, note });

    return res.status(201).json({ message: 'Contribution added', fund, transaction: tx });
  } catch (e) {
    console.error('add contribution error', e);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.withdraw = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const { amount, note } = req.body;
    const val = Number(amount || 0);
    if (val <= 0) return res.status(400).json({ message: 'Amount must be > 0' });

    const fund = await EmergencyFund.findOne({ user: user._id });
    if (!fund) return res.status(404).json({ message: 'No emergency fund set up yet.' });
    if (val > fund.currentBalance) return res.status(400).json({ message: 'Insufficient balance.' });

    fund.currentBalance -= val;
    await fund.save();
    const tx = await FundTx.create({ user: user._id, fund: fund._id, type: 'withdrawal', amount: val, note });

    return res.status(201).json({ message: 'Withdrawal recorded', fund, transaction: tx });
  } catch (e) {
    console.error('withdraw error', e);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listTransactions = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const fund = await EmergencyFund.findOne({ user: user._id });
    if (!fund) return res.status(404).json({ message: 'No emergency fund set up yet.' });

    const [items, total] = await Promise.all([
      FundTx.find({ user: user._id, fund: fund._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FundTx.countDocuments({ user: user._id, fund: fund._id })
    ]);

    return res.status(200).json({ page, limit, total, items });
  } catch (e) {
    console.error('list tx error', e);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const { targetAmount, targetMonths, targetDate } = req.body;

    const fund = await EmergencyFund.findOne({ user: user._id });
    if (!fund) return res.status(404).json({ message: 'No emergency fund set up yet.' });

    if (targetAmount != null) fund.targetAmount = Number(targetAmount);
    if (targetMonths != null) fund.targetMonths = Number(targetMonths);
    if (targetDate) fund.targetDate = new Date(targetDate);

    const remaining = Math.max(0, fund.targetAmount - fund.currentBalance);
    if (fund.targetDate) {
      fund.monthlyPlan = Math.ceil(remaining / monthDiff(new Date(), new Date(fund.targetDate)));
    } else {
      fund.monthlyPlan = Math.ceil(remaining / Math.max(1, fund.targetMonths || 6));
    }

    await fund.save();
    return res.status(200).json({ message: 'Goal updated', fund });
  } catch (e) {
    console.error('update goal error', e);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
