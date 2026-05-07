// SHAFT compliance + federal TCPA prohibited content categories.
// Blocks messages before they hit Twilio to protect the 10DLC campaign.

const BLOCKED = [
  {
    category: "cannabis",
    pattern: /\b(cannabis|marijuana|weed|thc|cbd|dispensary|hemp|edible|gummy)\b/i,
  },
  {
    category: "firearms",
    pattern: /\b(gun|firearm|weapon|ammo|ammunition|rifle|pistol|shotgun|handgun|ar-15|ak-47)\b/i,
  },
  {
    category: "adult content",
    pattern: /\b(sex|porn|adult|xxx|nude|naked|escort|onlyfans|strip club)\b/i,
  },
  {
    category: "gambling",
    pattern: /\b(gambling|casino|bet|betting|lottery|jackpot|slots|poker|wager)\b/i,
  },
  {
    category: "tobacco",
    pattern: /\b(tobacco|cigarette|cigar|vape|vaping|nicotine|e-cigarette|juul)\b/i,
  },
  {
    category: "predatory lending",
    pattern: /\b(payday loan|cash advance|get rich quick|guaranteed income|make money fast|mlm|pyramid)\b/i,
  },
  {
    category: "phishing",
    pattern: /\b(click here to claim|you('ve| have) won|free prize|congratulations you|wire transfer)\b/i,
  },
];

/**
 * Returns ok:true if the message passes content rules,
 * or ok:false with the category that triggered the block.
 */
export function checkContent(message: string): { ok: boolean; category?: string } {
  for (const { category, pattern } of BLOCKED) {
    if (pattern.test(message)) return { ok: false, category };
  }
  return { ok: true };
}
