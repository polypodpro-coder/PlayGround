// Illustrative pricing only. A live checkout must use an immutable server quote.
export function previewPrice({unitPrice,grams=55,quantity=1,multiplier=1,addons=0}) {
  if(!Number.isInteger(quantity)||quantity<1||quantity>100) throw new Error('Quantity must be 1–100.');
  for(const value of [unitPrice,grams,multiplier,addons]) if(!Number.isFinite(value)||value<0) throw new Error('Invalid estimate input.');
  if(grams<=0||grams>10000||unitPrice>100000||multiplier>10||addons>10000) throw new Error('Estimate is outside supported limits.');
  const unitCents=Math.max(800,Math.round((unitPrice*multiplier*grams/55+addons)*100));
  return {price:unitCents*quantity/100,unitPrice:unitCents/100,quantity};
}
