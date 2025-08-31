const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const MealGroup = require('../models/mealGroupModel');
const GroceryItem = require('../models/groceryItemModel');
const MealEntry = require('../models/mealEntryModel');
const ShoppingDuty = require('../models/shoppingDutyModel');

// ============ user resolver (NO AUTH) ============
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

// ============ helpers ============
function normEmail(e) { return (e || '').toLowerCase().trim(); }
function dayStart(d)   { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function dayEnd(d)     { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function normalizeEmails(emails = []) {
  return [...new Set(emails.filter(Boolean).map(normEmail))];
}

async function loadGroupOrFail(req, res, user, requireAdmin = false) {
  const { groupId } = req.params;
  if (!isValidObjectId(groupId)) {
    res.status(400).json({ message: 'Invalid groupId' }); return null;
  }
  const group = await MealGroup.findById(groupId);
  if (!group) { res.status(404).json({ message: 'Group not found' }); return null; }
  const isMember = group.members.some(m => m.email === user.email);
  if (!isMember) { res.status(403).json({ message: 'Not a member of this group' }); return null; }
  if (requireAdmin) {
    const isCreator = group.createdBy?.toString() === user._id.toString();
    const isAdmin = group.members.some(m => m.email === user.email && m.role === 'admin');
    if (!isCreator && !isAdmin) { res.status(403).json({ message: 'Only creator/admin can do this' }); return null; }
  }
  return group;
}

async function ensureMembers(group, emailsWithNames = []) {
  const map = new Map(group.members.map(m => [m.email, m]));
  emailsWithNames.forEach(({ email, name }) => {
    const key = normEmail(email);
    if (!key) return;
    if (!map.has(key)) group.members.push({ email: key, name, role: 'member' });
  });
  await group.save();
  return group;
}

function settleGreedy(balances) {
  const debtors = [], creditors = [];
  for (const [email, v] of Object.entries(balances)) {
    const x = Math.round(v * 100) / 100;
    if (x < -0.009) debtors.push({ email, amt: -x });
    else if (x > 0.009) creditors.push({ email, amt: x });
  }
  debtors.sort((a,b)=>b.amt-a.amt); creditors.sort((a,b)=>b.amt-a.amt);
  const out = []; let i=0, j=0;
  while (i<debtors.length && j<creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].email, to: creditors[j].email, amount: Math.round(pay*100)/100 });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt <= 0.009) i++; if (creditors[j].amt <= 0.009) j++;
  }
  return out;
}

// ============ Group ============
exports.createGroup = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const { name, members = [] } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required.' });

    const emails = normalizeEmails([user.email, ...members.map(m => m.email || m)]);
    const memberObjs = emails.map(e => ({
      email: e, name: (members.find(m => (m.email||m) === e)?.name) || (e===user.email?'You':''), role: e===user.email?'admin':'member'
    }));

    const group = await MealGroup.create({ name, createdBy: user._id, members: memberObjs });
    return res.status(201).json({ message: 'Group created', group });
  } catch (e) {
    console.error('createGroup error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listMyGroups = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const groups = await MealGroup.find({ 'members.email': user.email }).sort('-updatedAt');
    return res.status(200).json({ groups });
  } catch (e) {
    console.error('listMyGroups error', e?.message);
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
    await ensureMembers(group, emailsWithNames);
    return res.status(200).json({ message: 'Members added', group });
  } catch (e) {
    console.error('addMembers error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// ============ Grocery Items ============
exports.addItem = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const { name, quantity = 1, unit, neededForDate, neededForMeal } = req.body || {};
    if (!name) return res.status(400).json({ message: 'Item name is required' });

    const item = await GroceryItem.create({
      group: group._id,
      name: String(name).trim(),
      quantity: Number(quantity || 1),
      unit,
      neededForDate: neededForDate ? new Date(neededForDate) : undefined,
      neededForMeal: neededForMeal || null
    });

    return res.status(201).json({ message: 'Item added', item });
  } catch (e) {
    console.error('addItem error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listItems = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const purchased = req.query.purchased;
    const filter = { group: group._id };
    if (purchased === 'true') filter.purchased = true;
    if (purchased === 'false') filter.purchased = false;

    const items = await GroceryItem.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ items });
  } catch (e) {
    console.error('listItems error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.purchaseItem = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const { itemId } = req.params;
    if (!isValidObjectId(itemId)) return res.status(400).json({ message: 'Invalid itemId' });

    const { amount, paidByEmail, purchasedAt } = req.body || {};
    const total = Number(String(amount ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(total) || total <= 0) return res.status(400).json({ message: 'Positive amount required' });

    // prefer provided payer; else infer from duty if exists on that day
    let payer = normEmail(paidByEmail);
    const when = purchasedAt ? new Date(purchasedAt) : new Date();
    if (!payer) {
      const duty = await ShoppingDuty.findOne({ group: group._id, date: dayStart(when) });
      if (duty) payer = duty.email;
      else payer = user.email; // fallback to caller
    }

    await ensureMembers(group, [{ email: payer }]);

    const item = await GroceryItem.findOneAndUpdate(
      { _id: itemId, group: group._id },
      { $set: { purchased: true, amount: total, paidByEmail: payer, purchasedAt: when } },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });

    return res.status(200).json({ message: 'Item purchased', item });
  } catch (e) {
    console.error('purchaseItem error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// ============ Shopping Duty ============
exports.assignDuties = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user, true);
    if (!group) return;

    // body can be: { duties: [{date, email}, ...] }
    const { duties = [] } = req.body || {};
    if (!Array.isArray(duties) || !duties.length) {
      return res.status(400).json({ message: 'duties array is required' });
    }

    // ensure members
    await ensureMembers(group, duties.map(d => ({ email: d.email })));

    // upsert per day
    const results = [];
    for (const d of duties) {
      const day = dayStart(d.date);
      const email = normEmail(d.email);
      if (!email || !day) continue;

      const updated = await ShoppingDuty.findOneAndUpdate(
        { group: group._id, date: day },
        { $set: { email, note: d.note || '' } },
        { new: true, upsert: true }
      );
      results.push(updated);
    }

    return res.status(200).json({ message: 'Duties assigned', duties: results });
  } catch (e) {
    console.error('assignDuties error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listDuties = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const { from, to } = req.query;
    const q = { group: group._id };
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = dayStart(from);
      if (to)   q.date.$lte = dayEnd(to);
    }
    const duties = await ShoppingDuty.find(q).sort({ date: 1 });
    return res.status(200).json({ duties });
  } catch (e) {
    console.error('listDuties error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// ============ Meal Entries (who ate how much) ============
exports.recordMeals = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    // body can be: { entries: [{email, date, meal, servings}, ...] }
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ message: 'entries array is required' });
    }

    // ensure members exist
    await ensureMembers(group, entries.map(e => ({ email: e.email })));

    const docs = await MealEntry.insertMany(entries.map(e => ({
      group: group._id,
      email: normEmail(e.email),
      date: new Date(e.date),
      meal: e.meal,
      servings: Number(e.servings || 1)
    })));

    return res.status(201).json({ message: 'Meals recorded', items: docs });
  } catch (e) {
    console.error('recordMeals error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.listMeals = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const { from, to, email } = req.query;
    const q = { group: group._id };
    if (email) q.email = normEmail(email);
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to)   q.date.$lte = new Date(to);
    }
    const items = await MealEntry.find(q).sort({ date: -1, createdAt: -1 });
    return res.status(200).json({ items });
  } catch (e) {
    console.error('listMeals error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// ============ Summary (cost per meal & settlements) ============
exports.summary = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const group = await loadGroupOrFail(req, res, user);
    if (!group) return;

    const { from, to } = req.query;
    const range = {};
    if (from || to) {
      range.createdAt = {};
      if (from) range.createdAt.$gte = new Date(from);
      if (to)   range.createdAt.$lte = new Date(to);
    }

    // total spend by payer
    const purchased = await GroceryItem.find({ group: group._id, purchased: true, ...range });
    const spendBy = {};
    let totalSpend = 0;
    purchased.forEach(it => {
      const payer = normEmail(it.paidByEmail || '');
      const amt = Number(it.amount || 0);
      if (amt > 0) {
        spendBy[payer] = (spendBy[payer] || 0) + amt;
        totalSpend += amt;
      }
    });

    // total servings by eater
    const mealQ = { group: group._id };
    if (from || to) {
      mealQ.date = {};
      if (from) mealQ.date.$gte = new Date(from);
      if (to)   mealQ.date.$lte = new Date(to);
    }
    const entries = await MealEntry.find(mealQ);
    const servingsBy = {};
    let totalServings = 0;
    entries.forEach(e => {
      const em = normEmail(e.email);
      const s  = Number(e.servings || 0);
      if (s > 0) {
        servingsBy[em] = (servingsBy[em] || 0) + s;
        totalServings += s;
      }
    });

    const costPerServing = totalServings > 0 ? Math.round((totalSpend / totalServings) * 100) / 100 : 0;

    // owed = servings * costPerServing, balance = paid - owed
    const balances = {};
    group.members.forEach(m => {
      const email = m.email;
      const paid = Math.round((spendBy[email] || 0) * 100) / 100;
      const owed = Math.round(((servingsBy[email] || 0) * costPerServing) * 100) / 100;
      balances[email] = Math.round((paid - owed) * 100) / 100;
    });

    const suggestions = settleGreedy(balances);

    return res.status(200).json({
      from: from || null,
      to: to || null,
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalServings: Math.round(totalServings * 100) / 100,
      costPerServing,
      spendBy,
      servingsBy,
      balances,
      suggestions
    });
  } catch (e) {
    console.error('summary error', e?.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
