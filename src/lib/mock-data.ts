// Sample data only — real Messenger threads replace this once the
// Facebook page connection is approved. Shape is deliberately close to
// what the Meta Conversations API returns.

export type Lang = "en" | "zh" | "mix";

export type Message = {
  id: string;
  from: "customer" | "ac";
  text: string;
  time: string;
  agent?: string;
};

export type Suggestion = {
  id: string;
  lang: Lang;
  text: string;
  source: string;
};

export type OrderFacts = {
  orderNo: string;
  placed: string;
  items: string;
  value: string;
  courier: string;
  tracking: string;
  status: string;
  statusTone: "ok" | "warn" | "bad";
};

export type Conversation = {
  id: string;
  name: string;
  channel: "messenger" | "whatsapp";
  topic: string;
  waitingMins: number;
  status: "need_reply" | "waiting" | "done";
  order?: OrderFacts;
  messages: Message[];
  suggestions: Suggestion[];
  /** Money, refunds and complaints are never pre-filled — CS must write it. */
  writeItYourself?: boolean;
  riskNote?: string;
};

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    name: "Michelle Tan",
    channel: "messenger",
    topic: "Where is my order",
    waitingMins: 47,
    status: "need_reply",
    order: {
      orderNo: "AC-88421",
      placed: "14 Aug 2026",
      items: "Aria Lace Midi Dress · Black · M",
      value: "RM 189.00",
      courier: "J&T Express",
      tracking: "639284471055",
      status: "In transit — Shah Alam hub, out for delivery tomorrow",
      statusTone: "ok",
    },
    messages: [
      { id: "m1", from: "customer", text: "Hi, 我上个礼拜买的裙子", time: "10:12" },
      { id: "m2", from: "customer", text: "已经一个礼拜了还没收到 😩", time: "10:12" },
      { id: "m3", from: "customer", text: "是不是没有寄出啊?", time: "10:31" },
    ],
    suggestions: [
      {
        id: "s1",
        lang: "zh",
        text: "Michelle 你好 🙏 已经帮你查了！你的订单 AC-88421（Aria Lace 黑色 M）8月14号已经由 J&T 寄出，追踪号码 639284471055。现在到了莎阿南分行，明天就会送到你手上咯～ 收到记得跟我说一声哦 💕",
        source: "Shipping SOP + 12 past replies by Chin Pui",
      },
      {
        id: "s2",
        lang: "en",
        text: "Hi Michelle 🙏 Just checked for you! Your order AC-88421 (Aria Lace Midi, Black, M) shipped on 14 Aug via J&T, tracking 639284471055. It is at the Shah Alam hub now and out for delivery tomorrow. Sorry for the wait — do let me know once it arrives 💕",
        source: "Shipping SOP + 12 past replies",
      },
      {
        id: "s3",
        lang: "mix",
        text: "Hi Michelle 🙏 已经帮你 check 了! Your order AC-88421 shipped 14 Aug by J&T, tracking 639284471055. 现在在 Shah Alam hub, tomorrow 就到咯~ Sorry for the wait ya 💕",
        source: "Shipping SOP + 8 past replies",
      },
    ],
  },
  {
    id: "c2",
    name: "Nurul Aisyah",
    channel: "messenger",
    topic: "Stock / size",
    waitingMins: 12,
    status: "need_reply",
    messages: [
      { id: "m1", from: "customer", text: "Hi! The black lace dress from last night live", time: "11:40" },
      { id: "m2", from: "customer", text: "still got size M ah?", time: "11:41" },
    ],
    suggestions: [
      {
        id: "s1",
        lang: "en",
        text: "Hi Nurul! 😊 Yes — Aria Lace Midi in Black size M is still available, RM 189. Only 4 pieces left after last night's live though, it moves fast. Want me to reserve one for you?",
        source: "Live stock sheet (21 Aug) + 9 past replies",
      },
      {
        id: "s2",
        lang: "zh",
        text: "Nurul 你好 😊 有的！Aria 黑色蕾丝 M 码还有货，RM 189。昨晚直播后只剩最后 4 件咯，走得蛮快的～ 要我先帮你留一件吗?",
        source: "Live stock sheet (21 Aug) + 9 past replies",
      },
      {
        id: "s3",
        lang: "mix",
        text: "Hi Nurul 😊 Still got! Aria Lace 黑色 M 码 RM 189. 昨晚 live 后 last 4 pieces only, 走得很快 ya~ Want me 帮你 reserve 一件?",
        source: "Live stock sheet + 6 past replies",
      },
    ],
  },
  {
    id: "c3",
    name: "Lim Sue Wen",
    channel: "messenger",
    topic: "Exchange",
    waitingMins: 132,
    status: "need_reply",
    order: {
      orderNo: "AC-87904",
      placed: "9 Aug 2026",
      items: "Selene Satin Slip · Champagne · L",
      value: "RM 159.00",
      courier: "J&T Express",
      tracking: "639211804372",
      status: "Delivered 13 Aug — 8 days ago (exchange window 14 days)",
      statusTone: "warn",
    },
    messages: [
      { id: "m1", from: "customer", text: "I bought the champagne slip but L is too big for me", time: "09:18" },
      { id: "m2", from: "customer", text: "can change to M? still have tag never wear", time: "09:19" },
    ],
    suggestions: [
      {
        id: "s1",
        lang: "en",
        text: "Hi Sue Wen! 😊 No problem — you are still inside our 14-day exchange window (delivered 13 Aug, 6 days left). Since the tag is still on, I can arrange an exchange to size M. Sending you the return steps now, and I will hold an M for you so it does not run out 🙏",
        source: "Return & Exchange SOP + 15 past replies",
      },
      {
        id: "s2",
        lang: "zh",
        text: "Sue Wen 你好 😊 没问题的！你还在 14 天换货期内（13号收到，还有 6 天）。吊牌还在的话可以换 M 码。我现在把换货步骤发给你，也先帮你留一件 M，怕断码 🙏",
        source: "Return & Exchange SOP + 15 past replies",
      },
      {
        id: "s3",
        lang: "mix",
        text: "Hi Sue Wen 😊 Can 的！还在 14 天 exchange window (13号 delivered, 还有 6 天). Tag 还在 so can change to M. 我发换货 steps 给你, 也先 hold 一件 M 怕断码 🙏",
        source: "Return & Exchange SOP + 11 past replies",
      },
    ],
  },
  {
    id: "c4",
    name: "Grace Wong",
    channel: "messenger",
    topic: "Damaged item",
    waitingMins: 8,
    status: "need_reply",
    writeItYourself: true,
    riskNote:
      "Complaint with possible refund. The AI will not pre-write this one — please answer in your own words.",
    order: {
      orderNo: "AC-88510",
      placed: "16 Aug 2026",
      items: "Vera Pleated Skirt · Ivory · S",
      value: "RM 139.00",
      courier: "J&T Express",
      tracking: "639290117744",
      status: "Delivered 20 Aug — yesterday",
      statusTone: "ok",
    },
    messages: [
      { id: "m1", from: "customer", text: "收到的裙子有个洞 😭", time: "12:03" },
      { id: "m2", from: "customer", text: "[Photo]", time: "12:03" },
      { id: "m3", from: "customer", text: "很失望 我是买来参加婚礼的", time: "12:04" },
    ],
    suggestions: [
      {
        id: "s1",
        lang: "en",
        text: "",
        source:
          "Reminders — apologise first · photo already received · offer replacement or refund · escalate to Chin Pui if she asks for a refund",
      },
    ],
  },
  {
    id: "c5",
    name: "Poh Yee",
    channel: "whatsapp",
    topic: "Payment sent",
    waitingMins: 25,
    status: "need_reply",
    messages: [
      { id: "m1", from: "customer", text: "已经转账了 请查收 🙏", time: "11:28" },
      { id: "m2", from: "customer", text: "[Payment screenshot]", time: "11:28" },
    ],
    suggestions: [
      {
        id: "s1",
        lang: "zh",
        text: "Poh Yee 你好 🙏 收到你的转账截图了，我现在拿去给财务对账，通常 30 分钟内就会确认。确认好我马上通知你，然后今天就帮你安排出货 💕",
        source: "Payment SOP + 22 past replies",
      },
      {
        id: "s2",
        lang: "en",
        text: "Hi Poh Yee 🙏 Received your payment screenshot! Passing it to our finance team to verify now — usually confirmed within 30 minutes. I will message you the moment it clears and we will arrange shipping today 💕",
        source: "Payment SOP + 22 past replies",
      },
      {
        id: "s3",
        lang: "mix",
        text: "Hi Poh Yee 🙏 收到你的 payment screenshot 了! 现在拿去 finance check, usually 30 分钟内 confirm. Confirm 好我马上 update 你, 今天就帮你 arrange shipping 💕",
        source: "Payment SOP + 14 past replies",
      },
    ],
  },
  {
    id: "c6",
    name: "Farah Idris",
    channel: "messenger",
    topic: "Where is my order",
    waitingMins: 0,
    status: "done",
    messages: [
      { id: "m1", from: "customer", text: "hi where is my parcel ah", time: "Yesterday 15:02" },
      {
        id: "m2",
        from: "ac",
        text: "Hi Farah 🙏 Your order AC-88377 is out for delivery today with J&T, tracking 639277120944. Should reach you by this evening!",
        time: "Yesterday 15:06",
        agent: "Chin Pui",
      },
      { id: "m3", from: "customer", text: "thank you!! received already 😍", time: "Yesterday 18:44" },
    ],
    suggestions: [],
  },
  {
    id: "c7",
    name: "Tan Wei Ling",
    channel: "messenger",
    topic: "Exchange",
    waitingMins: 0,
    status: "waiting",
    messages: [
      { id: "m1", from: "customer", text: "ok I will post back tomorrow", time: "Yesterday 16:20" },
      {
        id: "m2",
        from: "ac",
        text: "Noted Wei Ling 🙏 Once you have posted it, send me the tracking number here and I will get your M size out the same day.",
        time: "Yesterday 16:24",
        agent: "Jia Hui",
      },
    ],
    suggestions: [],
  },
];

export const AGENT = { name: "Chin Pui", role: "CS Lead" };
