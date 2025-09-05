const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const SplitGroup = require('../models/splitGroupModel');
const SplitExpense = require('../models/splitExpenseModel');
const SplitSettlement = require('../models/splitSettlementModel');

async function resolveUser(req) {
  const User = require('../models/userModel');
  const emailFromHeader = (req.header('x-user-email') || '').toLowerCase().trim();
  const email = emailFromHeader || (process.env.DEV_USER_EMAIL || 'dev@example.com').toLowerCase();

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: 'Dev User',
      username: `dev_${Date.now()}`,
      email,
      password: 'devpass123',
      firstLoginVerified: true
    });
  }
  return user;
}

// ---------- helpers ----------
function normalizeEmails(emails = []) {
  return [...new Set(emails.filter(Boolean).map(e => e.toLowerCase().trim()))];
}

function computeEqualShares(total, n) {
  const base = Math.floor((total / n) * 100) / 100;
  const shares = Array(n).fill(base);
  let remainder = Math.round((total - base * n) * 100) / 100;
  let i = 0;
  while (remainder > 0 && i < n) {
    shares[i] = Math.round((shares[i] + 0.01) * 100) / 100;
    remainder = Math.round((remainder - 0.01) * 100) / 100;
    i++;
  }
  return shares;
}

function settleGreedy(balances) {
  const debtors = [];
  const creditors = [];
  Object.entries(balances).forEach(([email, amt]) => {
    const v = Math.round(amt * 100) / 100;
    if (v < -0.009) debtors.push({ email, amt: -v });
    else if (v > 0.009) creditors.push({ email, amt: v });
  });
  debtors.sort((a,b)=>b.amt-a.amt);
  creditors.sort((a,b)=>b.amt-a.amt);

  const out = [];
  let i=0, j=0;
  while (i<debtors.length && j<creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].email, to: creditors[j].email, amount: Math.round(pay * 100) / 100 });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt <= 0.009) i++;
    if (creditors[j].amt <= 0.009) j++;
  }
  return out;
}

async function ensureGroupMembers(group, emailsWithNames = []) {
  const map = new Map(group.members.map(m => [m.email, m]));
  emailsWithNames.forEach(({email, name}) => {
    const key = (email || '').toLowerCase().trim();
    if (!key) return;
    if (!map.has(key)) group.members.push({ email: key, name, role: 'member' });
  });
  await group.save();
  return group;
}


async function loadGroupOrFail(req, res, user, requireAdmin = false) {
  const { groupId } = req.params;

  if (!isValidObjectId(groupId)) {
    res.status(400).json({ message: 'Invalid groupId' });
    return null;
  }

  const group = await SplitGroup.findById(groupId);
  if (!group) {
    res.status(404).json({ message: 'Group not found' });
    return null;
  }

  const isMember = group.members.some(m => m.email === user.email);
  if (!isMember) {
    res.status(403).json({ message: 'Not a member of this group' });
    return null;
  }

  if (requireAdmin) {
    const isCreator = group.createdBy?.toString() === user._id.toString();
    const isAdmin = group.members.some(m => m.email === user.email && m.role === 'admin');
    if (!isCreator && !isAdmin) {
      res.status(403).json({ message: 'Only creator or admin can perform this action' });
      return null;
    }
  }

  return group;
}

exports.createGroup = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const { name, members = [] } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required.' });

    const emails = normalizeEmails([user.email, ...members.map(m => m.email || m)]);
    const memberObjs = emails.map(e => ({
      email: e,
      name: (members.find(m => (m.email||m) === e)?.name) || (e === user.email ? 'You' : ''),
      role: e === user.email ? 'admin' : 'member'
    }));

    const group = await SplitGroup.create({
      name,
      createdBy: user._id,
      members: memberObjs
    });

    return res.status(201).json({ message: 'Group created', group });
  } catch (e) {
    console.error('createGroup error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listMyGroups = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const groups = await SplitGroup.find({ 'members.email': user.email }).sort('-updatedAt');
    return res.status(200).json({ groups });
  } catch (e) {
    console.error('listMyGroups error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.addMembers = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user, true);
    if (!group) return;

    const { members = [] } = req.body;
    const emailsWithNames = (members || []).map(m => (typeof m === 'string' ? { email: m } : m));
    await ensureGroupMembers(group, emailsWithNames);

    return res.status(200).json({ message: 'Members added', group });
  } catch (e) {
    console.error('addMembers error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const {
      amount, description, category, date,
      paidByEmail, splitType = 'equal',
      participants = [],
    } = req.body || {};

    const total = Number(String(amount ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ message: 'Amount must be > 0' });
    }

    const payerEmail = (paidByEmail || user.email).toLowerCase().trim();

    let emails = participants.map(p => (typeof p === 'string' ? p : p?.email));
    emails = normalizeEmails(emails.length ? emails : group.members.map(m => m.email));
    if (!emails.length) return res.status(400).json({ message: 'No participants provided or found in group' });

    let shares = [];
    if (splitType === 'equal') {
      const eq = computeEqualShares(total, emails.length);
      shares = emails.map((e, i) => ({ email: e, share: eq[i] }));
    } else if (splitType === 'shares') {
      if (!participants.length || participants.some(p => p == null || p.weight == null)) {
        return res.status(400).json({ message: 'For "shares", provide participants with positive weights' });
      }
      const weights = participants.map(p => Number(p.weight || 0));
      const sumW = weights.reduce((a,b)=>a+b,0);
      if (emails.length !== weights.length || sumW <= 0) {
        return res.status(400).json({ message: 'Weights must match participants and sum > 0' });
      }
      shares = emails.map((e,i) => ({
        email: e,
        share: Math.round((total * (weights[i]/sumW)) * 100) / 100
      }));
    } else if (splitType === 'percent') {
      if (!participants.length || participants.some(p => p == null || p.percent == null)) {
        return res.status(400).json({ message: 'For "percent", provide percents summing to 100' });
      }
      const perc = participants.map(p => Number(p.percent || 0));
      const sumP = Math.round(perc.reduce((a,b)=>a+b,0) * 100) / 100;
      if (emails.length !== perc.length || Math.abs(sumP - 100) > 0.01) {
        return res.status(400).json({ message: 'Percents must match participants and sum to 100' });
      }
      shares = emails.map((e,i) => ({
        email: e,
        share: Math.round((total * (perc[i]/100)) * 100) / 100
      }));
    } else if (splitType === 'exact') {
      if (!participants.length || participants.some(p => p == null || p.amount == null)) {
        return res.status(400).json({ message: 'For "exact", provide participants with explicit amounts' });
      }
      const amts = participants.map(p => Number(p.amount || 0));
      const sumA = Math.round(amts.reduce((a,b)=>a+b,0) * 100) / 100;
      if (emails.length !== amts.length || Math.abs(sumA - total) > 0.01) {
        return res.status(400).json({ message: 'Exact amounts must match participants and sum to total' });
      }
      shares = emails.map((e,i) => ({ email: e, share: amts[i] }));
    } else {
      return res.status(400).json({ message: 'Invalid splitType' });
    }

    await ensureGroupMembers(group, shares.map(s => ({ email: s.email })));
    await ensureGroupMembers(group, [{ email: payerEmail }]);

    const expense = await SplitExpense.create({
      group: group._id,
      paidBy: { email: payerEmail },
      amount: total,
      description, category, date,
      splitType,
      participants: shares
    });

    return res.status(201).json({ message: 'Expense recorded', expense });
  } catch (e) {
    console.error('addExpense error:', e?.name, e?.message, e?.stack);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listExpenses = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const items = await SplitExpense.find({ group: group._id }).sort({ createdAt: -1 });
    return res.status(200).json({ items });
  } catch (e) {
    console.error('listExpenses error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const { expenseId } = req.params;
    if (!isValidObjectId(expenseId)) {
      return res.status(400).json({ message: 'Invalid expenseId' });
    }

    await SplitExpense.deleteOne({ _id: expenseId, group: group._id });
    return res.status(200).json({ message: 'Expense deleted' });
  } catch (e) {
    console.error('deleteExpense error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.recordSettlement = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const { fromEmail, toEmail, amount, note } = req.body;
    const from = (fromEmail || '').toLowerCase().trim();
    const to   = (toEmail || '').toLowerCase().trim();
    const val  = Number(amount || 0);
    if (!from || !to || !(val > 0)) {
      return res.status(400).json({ message: 'fromEmail, toEmail and positive amount are required' });
    }

    await ensureGroupMembers(group, [{email: from}, {email: to}]);

    const s = await SplitSettlement.create({
      group: group._id,
      from: { email: from },
      to:   { email: to },
      amount: val,
      note
    });
    return res.status(201).json({ message: 'Settlement recorded', settlement: s });
  } catch (e) {
    console.error('recordSettlement error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listSettlements = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const items = await SplitSettlement.find({ group: group._id }).sort({ createdAt: -1 });
    return res.status(200).json({ items });
  } catch (e) {
    console.error('listSettlements error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.groupSummary = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const balances = {};
    group.members.forEach(m => balances[m.email] = 0);

    const expenses = await SplitExpense.find({ group: group._id });
    expenses.forEach(exp => {
      balances[exp.paidBy.email] = (balances[exp.paidBy.email] || 0) + exp.amount;
      exp.participants.forEach(p => {
        balances[p.email] = (balances[p.email] || 0) - p.share;
      });
    });

    const settlements = await SplitSettlement.find({ group: group._id });
    settlements.forEach(s => {
      balances[s.from.email] = (balances[s.from.email] || 0) + s.amount;
      balances[s.to.email]   = (balances[s.to.email]   || 0) - s.amount;
    });

    Object.keys(balances).forEach(k => balances[k] = Math.round(balances[k] * 100) / 100);
    const suggestions = settleGreedy(balances);

    return res.status(200).json({ group, balances, suggestions });
  } catch (e) {
    console.error('groupSummary error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// BONUS: delete group + cascade
exports.deleteGroup = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user, /*requireAdmin*/ true);
    if (!group) return;

    await SplitExpense.deleteMany({ group: group._id });
    await SplitSettlement.deleteMany({ group: group._id });
    await group.deleteOne();

    return res.status(200).json({ message: 'Group and related records deleted' });
  } catch (e) {
    console.error('deleteGroup error:', e?.name, e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
