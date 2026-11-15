const Decimal = require('decimal.js').clone({ precision: 45, rounding: 4 });
const { z } = require('zod');

const quantity = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
const money = quantity.refine(value => new Decimal(value).decimalPlaces() <= 2, 'Use at most two decimal places');
const label = z.string().trim().min(1).max(160);
const id = z.string().regex(/^[1-9]\d{0,18}$/);
const stone = z.object({
  name: label, pieces: z.number().int().min(1).max(1000000), weight: quantity,
  unit: z.enum(['ct','g']), basis: z.enum(['carat','piece','fixed']), rate: quantity,
  certificate: label.optional()
}).strict();
const lineSchema = z.object({
  name: label, metal: label, purity: label, gross: quantity, deduction: quantity,
  deductionMode: z.enum(['other','combined','verified']),
  verifiedNet: quantity.optional(), verifiedSource: label.optional(),
  rate: quantity, stones: z.array(stone).max(50),
  makingMode: z.enum(['weight','percentage','fixed']), making: quantity,
  wastage: money, hallmarking: money, discount: money
}).strict();
const fixed = value => new Decimal(value).toFixed(2);
const sum = values => values.reduce((total, value) => total.plus(value), new Decimal(0));
function invalid(message) { throw Object.assign(new Error(message), { status: 422 }); }

function priceLine(input) {
  const line = lineSchema.parse(input);
  const stones = line.stones.map(stone => {
    const grams = new Decimal(stone.weight).times(stone.unit === 'ct' ? '0.2' : 1);
    const factor = { carat: grams.div('0.2'), piece: stone.pieces, fixed: 1 }[stone.basis];
    return { ...stone, grams: grams.toFixed(7), amount: fixed(new Decimal(stone.rate).times(factor)) };
  });
  const stoneWeight = sum(stones.map(stone => stone.grams));
  let deduction = new Decimal(line.deduction);
  if (line.deductionMode === 'other') deduction = deduction.plus(stoneWeight);
  if (line.deductionMode === 'verified') {
    if (line.verifiedNet === undefined || !line.verifiedSource || !deduction.isZero()) invalid('Verified net requires a source and zero entered deduction');
    deduction = new Decimal(line.gross).minus(line.verifiedNet);
  }
  const net = new Decimal(line.gross).minus(deduction);
  if (deduction.lt(stoneWeight) || net.lt(0)) invalid('Gross weight, net weight and deductions are inconsistent');
  const metalValue = fixed(net.times(line.rate));
  const makingBase = { weight: net, percentage: new Decimal(metalValue).div(100), fixed: 1 }[line.makingMode];
  const makingValue = fixed(new Decimal(line.making).times(makingBase));
  const stoneValue = fixed(sum(stones.map(stone => stone.amount)));
  const taxable = sum([metalValue, stoneValue, makingValue, line.wastage, line.hallmarking]).minus(line.discount);
  if (taxable.lt(0)) invalid('Discount exceeds line charges');
  return { ...line, stones, stoneWeight: stoneWeight.toFixed(7), net: net.toFixed(7), metalValue, makingValue, stoneValue, taxable: fixed(taxable) };
}

function calculate(lines, rules) {
  const items = z.array(lineSchema).min(1).max(100).parse(lines).map(priceLine);
  const subtotal = sum(items.map(item => item.taxable));
  let total = subtotal;
  const taxes = rules.filter(rule => rule.active).map(rule => {
    const base = rule.compound ? total : subtotal;
    const amount = rule.mode === 'percentage' ? fixed(base.times(rule.value).div(100)) : fixed(rule.value);
    total = total.plus(amount);
    return { ...rule, base: fixed(base), amount };
  });
  return { items, subtotal: fixed(subtotal), taxes, total: fixed(total) };
}
module.exports = { quantity, money, label, id, lineSchema, calculate, priceLine, fixed, sum, invalid, Decimal };
