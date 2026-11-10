// FAQ content, approved by the coach (draft doc, 10 Nov 2026).
// Plain data so it can be rendered and tested; edit wording here.

export interface FaqTable {
  caption: string;
  head: [string, string, string];
  rows: [string, string, string][];
}

export interface FaqItem {
  q: string;
  a: string[]; // paragraphs
  tables?: FaqTable[];
}

export interface FaqSection {
  id: string;
  title: string;
  /** Shown above the questions, always visible (used for red flags). */
  alert?: { title: string; lead: string; points: string[] };
  items: FaqItem[];
}

export const FAQ: FaqSection[] = [
  {
    id: "strength",
    title: "Strength training",
    items: [
      {
        q: "How hard should my sets feel?",
        a: [
          "Most working sets should finish with 1–3 reps still in the tank (RPE 7–9). Going to total failure every set adds fatigue without adding much. The RPE & RIR Chart in Training Tools shows what each number feels like.",
        ],
      },
      {
        q: "How do I know when to add weight?",
        a: [
          "When you hit the top of your rep range on every set and it still felt like RPE 8 or less, add the smallest jump you can: about 2.5 kg for upper body, 5 kg for lower body. Then build the reps back up.",
        ],
      },
      {
        q: "I missed a session. Do I make it up?",
        a: [
          "No. Pick up with the next planned session. Squeezing two sessions into one day usually costs more recovery than it's worth.",
        ],
      },
      {
        q: "Will lifting make me slow or bulky?",
        a: [
          "Not with a fight-sport program. Getting stronger relative to your bodyweight helps you hit harder, wrestle better and stay injury-free. Size comes mainly from eating a lot more than you burn, which a fight program doesn't ask for.",
        ],
      },
      {
        q: "Should I lift on the same day as sparring or hard skill work?",
        a: [
          "Yes, if you have to. Do skills first while you're fresh, or split them at least 6 hours apart. Tell your coach if a lifting day keeps landing after hard sparring.",
        ],
      },
      {
        q: "My numbers dropped this week. Is something wrong?",
        a: [
          "Usually not. Poor sleep, a hard week of training, a weight cut or a cold all drop your numbers for a few days. If it lasts more than 2 weeks, or comes with constant tiredness, tell your coach.",
        ],
      },
      {
        q: "How much rest between sets?",
        a: [
          "Heavy lifts (5 reps or fewer): 2–3 minutes. Moderate sets of 6–12: 60–90 seconds. Jumps and throws: rest until you feel fully fresh, usually 1–2 minutes, because quality matters more than fatigue.",
        ],
      },
      {
        q: "What if an exercise hurts?",
        a: [
          "Pain that's 3/10 or less and settles by the next day is usually fine to train through. If it's sharper than that, or worse the next morning, stop that exercise and check Injuries and niggles below.",
        ],
      },
    ],
  },
  {
    id: "injuries",
    title: "Injuries and niggles",
    alert: {
      title: "Stop training and get help today if you have any of these",
      lead: "Call 000 for chest pain, trouble breathing, or someone who is unconscious or confused after a head knock.",
      points: [
        'After a knock to the head: headache, dizziness, confusion, vomiting, blurred vision, memory gaps or feeling "not right". No more training that day; see a doctor before you return.',
        "Chest pain, a racing or irregular heartbeat, or fainting during or after training.",
        "Numbness, pins and needles or weakness running down an arm or leg, or any change in bladder or bowel control.",
        "You heard a pop, can't put weight on it, or it looks out of shape, especially with fast swelling.",
        "A hot, red, swollen calf, particularly after a long flight or a weight cut.",
        "Dark brown urine or severe muscle pain and swelling after a very hard session.",
        "Pain that wakes you at night or doesn't ease with rest, or pain with fever or weight loss you can't explain.",
      ],
    },
    items: [
      {
        q: "I've just tweaked something. What do I do for the first few days?",
        a: [
          "For the first 1–3 days protect it: ease off or modify anything that makes it hurt more, but keep moving what doesn't hurt. Raise it when you can, and use a compression bandage for swelling. Then tell your coach so your program can be adjusted.",
        ],
      },
      {
        q: "Should I take anti-inflammatories?",
        a: [
          "Check with a doctor or pharmacist first. Current guidance suggests holding off in the first few days of a soft-tissue injury, because inflammation is part of how it heals.",
        ],
      },
      {
        q: "When can I start training it again?",
        a: [
          "Usually within a few days. Gentle, pain-guided loading speeds up recovery more than complete rest. Your coach will swap exercises so you keep training around it.",
        ],
      },
      {
        q: "How much pain is OK while I train around a niggle?",
        a: [
          "Use this rule: pain during exercise up to 3/10 is acceptable, and it should settle back to normal by the next morning. If it goes above 3/10 or is worse the next day, back off that exercise and tell your coach.",
        ],
      },
      {
        q: "It's been a week and it's not getting better.",
        a: [
          "Book in with a physio or doctor, and let your coach know what they say so your program matches.",
        ],
      },
      {
        q: "I keep getting the same niggle.",
        a: [
          "That's usually a sign the load is jumping too fast, or there's a gap in strength or mobility. Mention it at your next check-in. Your mobility screen and testing results help find the cause.",
        ],
      },
    ],
  },
  {
    id: "nutrition",
    title: "Nutrition",
    items: [
      {
        q: "How much should I eat on training days compared with rest days?",
        a: [
          "Keep protein about the same every day and move your carbs with your training: more on hard days, less on rest days. The Nutrition Guide in Training Tools works out your carbs, protein and fat from your bodyweight, with a sample day split into meals. The numbers are for maintaining your weight, not gaining or cutting.",
        ],
      },
      {
        q: "I don't have chicken (or rice). What can I swap it for?",
        a: [
          "Use the tables below. Each row is roughly one serve; swap like for like within a table. Values are approximate, so check the label on your brand.",
        ],
        tables: [
          {
            caption: "Protein swaps (one serve ≈ 20–25 g protein)",
            head: ["Food", "Amount", "Protein (g)"],
            rows: [
              ["Chicken breast, cooked", "80 g", "25"],
              ["Lean beef mince, cooked", "100 g", "25"],
              ["Salmon, cooked", "100 g", "25"],
              ["Tuna in springwater, drained", "1 × 95 g can", "22"],
              ["Eggs", "4 large", "25"],
              ["Greek yoghurt, plain", "200 g", "20"],
              ["Cottage cheese", "200 g", "22"],
              ["Milk", "600 mL", "20"],
              ["Firm tofu", "200 g", "24"],
              ["Lentils, cooked", "1 cup (200 g)", "18"],
              ["Whey protein powder", "1 scoop (30 g)", "23"],
            ],
          },
          {
            caption: "Carb swaps (one serve ≈ 30 g carbs)",
            head: ["Food", "Amount", "Carbs (g)"],
            rows: [
              ["Rice, cooked", "¾ cup (110 g)", "30"],
              ["Pasta, cooked", "¾ cup (110 g)", "30"],
              ["Potato", "1 medium (200 g)", "30"],
              ["Sweet potato", "160 g", "30"],
              ["Bread", "2 slices", "28"],
              ["Rolled oats, dry", "½ cup (45 g)", "27"],
              ["Wrap", "1 large", "30"],
              ["Banana", "1 large", "30"],
              ["Rice cakes", "4", "28"],
              ["Medjool dates", "2", "35"],
            ],
          },
        ],
      },
      {
        q: "What should I eat before training?",
        a: [
          "A normal meal 2–4 hours before, or a small carb-based snack (banana, rice cakes, toast with honey) 30–60 minutes before if you're hungry. Keep it low in fat and fibre so it sits well.",
        ],
      },
      {
        q: "What should I eat after training?",
        a: [
          "A meal or snack with a serve of protein and some carbs within a couple of hours. If you train again the same day, eat sooner and lean on the carbs.",
        ],
      },
      {
        q: "I'm vegetarian or vegan. Can I still hit my protein?",
        a: [
          "Yes. Combine sources across the day (tofu, tempeh, lentils, beans, soy milk, eggs and dairy if you eat them) and aim for the higher end of your range. Tell your coach so they can check your iron and B12 intake with you.",
        ],
      },
      {
        q: "Do I need supplements?",
        a: [
          "Most people don't. Creatine (3–5 g a day) has the strongest evidence for strength and power. If you're drug-tested, only use batch-tested products (look for the HASTA or Informed Sport logo). Check with your coach before starting anything.",
        ],
      },
      {
        q: "How much water should I drink?",
        a: [
          "Enough that your urine is pale yellow most of the day. Drink more on hot days and around training, and rehydrate after hard sessions.",
        ],
      },
      {
        q: "I need to make weight for a fight.",
        a: [
          "Don't use the Nutrition Guide for this. Talk to your coach early so a safe cut can be planned, ideally with a sports dietitian.",
        ],
      },
    ],
  },
];
