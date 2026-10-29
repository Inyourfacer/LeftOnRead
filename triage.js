// On-device message triage: decides whether a text is worth replying to and suggests replies.
// Pure rules, no network. Works in the browser (window.Triage) and in Node (module.exports) for tests.
(function (root) {
  'use strict';

  const VERDICTS = {
    reply: 'Worth replying',
    maybe: 'Maybe reply',
    none: 'No reply needed',
    automated: 'Automated or spam',
  };

  // Each rule: [regex, points, reason]. Tested against the lowercased message.
  const AUTOMATED_RULES = [
    [/\b(verification|security|login|one[- ]time|confirmation)?\s*(code|otp|passcode|pin)\b[^\n]{0,40}\b\d{4,8}\b|\b\d{4,8}\b[^\n]{0,40}\b(is your|verification|code)\b/, 5, 'Verification code'],
    [/\bdo not share (this|it|your)\b|\bnever ask(s)? for (this|your) code\b/, 4, 'Security message'],
    [/\b(reply|text|txt) stop\b|\bstop to (end|opt|cancel|unsubscribe|quit)\b|\bunsubscribe\b|\bopt[- ]out\b|\bmsg ?& ?data rates\b/, 5, 'Marketing text (has opt-out)'],
    [/\b(your (package|order|parcel|delivery|shipment))\b|\bout for delivery\b|\bhas (been )?(shipped|delivered)\b|\btracking (number|#|link)\b/, 4, 'Delivery notification'],
    [/\byour (account|balance|statement) (is|has|was|ending)\b|\bcard ending( in)? \d{4}\b|\b(transaction|purchase|withdrawal|deposit|charge) of \$|\bpayment (is )?due\b|\bautopay\b/, 5, 'Account alert'],
    [/\breply (y|yes|c|1)\b[^\n]{0,20}\bto (confirm|cancel)\b|\b(appointment|reservation) (reminder|is (confirmed|scheduled))\b/, 5, 'Automated reminder'],
    [/\b(you('ve| have)? won|you are (a )?winner|congratulations[^\n]{0,30}(won|selected|winner|prize)|claim your (prize|reward|gift)|free (gift|iphone|cruise)|gift card)\b/, 6, 'Looks like a prize scam'],
    [/\b(unpaid toll|toll (balance|violation)|final notice|redeliver|suspended|verify your (account|identity)|account (has been )?locked|irs|warrant)\b/, 6, 'Looks like a phishing scam'],
    [/\b(crypto|bitcoin|investment opportunity|loan (approved|offer)|pre-?approved|debt relief|work from home|earn \$)\b/, 5, 'Looks like spam'],
    [/\b(act now|limited time|exclusive (deal|offer)|\d+% off|promo code|sale ends|shop now)\b/, 4, 'Promotional text'],
    [/\bwrong number\b.*\b(new|hello|hi)\b|^hi,? (is this|are you) \w+\??$/, 3, 'Possible "wrong number" scam opener'],
  ];

  const REPLY_RULES = [
    [/\?/, 3, 'Asks a question'],
    [/\b(can|could|would|will) you\b|\bplease\b|\bneed you to\b|\bmind (if|helping)\b/, 3, 'Asks you for something'],
    [/\b(let me know|lmk|get back to me|text me back|call me|hmu|thoughts)\b/, 3, 'Waiting on your answer'],
    [/\b(are|do|did|have|were|is) (you|u|we)\b|\b(wanna|want to|down to|free (tonight|tomorrow|this|on|later)|are we still|still on)\b/, 2, 'Expects a yes or no'],
    [/\b(dinner|lunch|brunch|breakfast|coffee|drinks|party|bbq|hang ?out|come over|movie|game night|this weekend|tonight|tomorrow)\b/, 2, 'About plans'],
    [/\b(i got (the|a|in|engaged|married|promoted)|guess what|big news|we('re| are) (pregnant|engaged|moving)|i passed|got the job)\b/, 3, 'Sharing news'],
    [/\b(miss you|thinking (of|about) you|love you|proud of you)\b/, 2, 'Personal'],
    [/\b(sorry|sad|rough (day|week)|hospital|passed away|funeral|sick|stressed|breakup|broke up)\b/, 3, 'Might need support'],
    [/\b(how are you|how('s| is) (it going|everything|life|work)|how have you been|what('s| is) up|wyd|hbu)\b/, 2, 'Checking in on you'],
    [/\b(urgent|asap|emergency|right now|call me now)\b/, 4, 'Sounds urgent'],
  ];

  // One or more acknowledgments in a row ("haha ok", "ok thanks!! 😂") with nothing else.
  const ACK = /^(?:(?:ok(ay)?|k+|cool|bet|word|thanks?( you)?( so much)?|thx|ty|tysm|lol+|lmao|haha+|hah?|nice|great|awesome|sounds good|perfect|got it|gotcha|np|no worries|no problem|yep|yup|ya|yeah|yes|sure|will do|you too|same|night|gn|good ?night|see you|see ya|ttyl|love you( too)?|ily|[\p{Extended_Pictographic}\u200d\ufe0f]+)[\s,.!]*)+$/iu;
  const TAPBACK = /^(liked|loved|laughed at|emphasi[sz]ed|disliked|questioned|reacted .{1,8} to|removed a .{1,20} from) [“"']/i;

  // Strip non-digits to spot short-code senders (e.g. 22395) used by businesses.
  function senderSignals(from) {
    const reasons = [];
    let points = 0;
    if (!from) return { points, reasons };
    const digits = from.replace(/\D/g, '');
    if (digits && digits.length <= 6 && digits.length === from.replace(/[\s()-]/g, '').length) {
      points += 5; reasons.push('Sent from a business short code');
    } else if (/@/.test(from) && !/\s/.test(from)) {
      points += 1; reasons.push('Sent from an email address');
    } else if (/^\+?[\d\s().-]{7,}$/.test(from)) {
      points += 1; reasons.push('Number isn\'t in your contacts');
    }
    return { points, reasons };
  }

  function score(rules, text) {
    let points = 0;
    const reasons = [];
    for (const [re, p, why] of rules) {
      if (re.test(text)) { points += p; reasons.push(why); }
    }
    return { points, reasons };
  }

  function detectIntent(t) {
    if (/\b(sorry|sad|rough (day|week)|hospital|passed away|funeral|sick|stressed|breakup|broke up)\b/.test(t)) return 'support';
    if (/\b(i got (the|a|in|engaged|married|promoted)|guess what|big news|we('re| are) (pregnant|engaged|moving)|i passed|got the job)\b/.test(t)) return 'news';
    if (/\bhappy (birthday|bday|b-day)\b|\bhbd\b/.test(t)) return 'birthday';
    if (/\b(dinner|lunch|brunch|breakfast|coffee|drinks|party|bbq|hang ?out|come over|movie|game night|wanna|want to|down to|free (tonight|tomorrow|this|on|later)|are we still|still on)\b/.test(t)) return 'plans';
    if (/\b(can|could|would|will) you\b|\bneed you to\b|\bplease\b/.test(t)) return 'request';
    if (/\b(how are you|how('s| is) (it going|everything|life|work)|how have you been|what('s| is) up|wyd|hbu)\b/.test(t)) return 'checkin';
    if (/\b(thank(s| you)|appreciate)\b/.test(t)) return 'thanks';
    if (/\?/.test(t)) return 'question';
    return 'general';
  }

  const SUGGESTIONS = {
    plans: [
      ["I'm in", "Yes, I'm in! What time works for you, {name}?"],
      ["Can't make it", "Ah, I wish I could {name}, but I can't make it this time. Rain check?"],
      ['Let me check', "Sounds fun! Let me check my schedule and get back to you."],
    ],
    request: [
      ['Sure', "Sure {name}, I can do that."],
      ["Can't right now", "Sorry {name}, I can't right now. Could [alternative] work instead?"],
      ['Let me check', "Let me check and get back to you on that."],
    ],
    question: [
      ['Answer', "Good question, {name}! [answer]"],
      ['Let me check', "Let me check and get back to you on that."],
      ['Call?', "Easier to explain on the phone. Free for a quick call [when]?"],
    ],
    checkin: [
      ["I'm good", "Hey {name}! I'm good, busy week but good. How are you doing?"],
      ['Been a while', "So good to hear from you {name}! It's been too long. How's everything?"],
      ['Catch up', "I'm doing well! We should catch up properly soon. Free [when]?"],
    ],
    news: [
      ['Congrats', "That's amazing {name}, congratulations!! 🎉"],
      ['Tell me more', "No way, that's huge! I want to hear everything."],
      ['Celebrate', "So happy for you {name}! We have to celebrate soon."],
    ],
    support: [
      ["I'm here", "I'm so sorry {name}. I'm here if you need anything."],
      ['Want to talk?', "That sounds really hard. Want to talk about it? I can call [when]."],
      ['Thinking of you', "Thinking of you {name}. Let me know if there's anything I can do."],
    ],
    birthday: [
      ['Thank you', "Thank you so much {name}! 😊"],
      ['Thanks + catch up', "Aw thank you {name}! We need to catch up soon."],
    ],
    thanks: [
      ['Anytime', "Anytime {name}!"],
      ['Happy to help', "Of course! Happy to help."],
    ],
    general: [
      ['Saw this', "Hey {name}! Just saw this. Give me a bit and I'll get back to you properly."],
      ['Sounds good', "Sounds good {name}!"],
      ['Tell me more', "Oh really? Tell me more."],
    ],
  };

  function classify(text, from) {
    const raw = String(text || '').trim();
    const t = raw.toLowerCase();
    if (!raw) return { verdict: 'none', label: VERDICTS.none, reasons: ['Empty message'], intent: 'general', score: 0 };

    const sender = senderSignals(from);
    const auto = score(AUTOMATED_RULES, t);
    const hasLink = /\bhttps?:\/\/|\b[a-z0-9-]+\.(com|net|org|co|info|xyz|top|ly|me|io|us)(\/\S*)?\b/.test(t);
    let autoPoints = auto.points + sender.points;
    const autoReasons = [...sender.reasons, ...auto.reasons];
    if (hasLink && (sender.points > 0 || auto.points > 0)) { autoPoints += 2; autoReasons.push('Contains a link'); }

    if (autoPoints >= 5) {
      return { verdict: 'automated', label: VERDICTS.automated, reasons: autoReasons, intent: 'general', score: -autoPoints };
    }
    if (TAPBACK.test(raw)) {
      return { verdict: 'none', label: VERDICTS.none, reasons: ['Just a reaction (tapback)'], intent: 'general', score: 0 };
    }
    if (ACK.test(raw)) {
      return { verdict: 'none', label: VERDICTS.none, reasons: ['Just an acknowledgment, so the conversation is wrapped up'], intent: 'general', score: 0 };
    }

    const want = score(REPLY_RULES, t);
    let points = want.points - Math.min(autoPoints, 4);
    const reasons = want.reasons.slice();
    if (raw.length >= 80) { points += 1; reasons.push('Long, personal message'); }
    if (autoReasons.length) reasons.push(...autoReasons.map(r => r + ' (be careful)'));

    const intent = detectIntent(t);
    if (intent === 'birthday') { points = Math.max(points, 3); reasons.push('Birthday wishes'); }

    const verdict = points >= 3 ? 'reply' : 'maybe';
    if (!reasons.length) reasons.push('No clear question or request, but it\'s from a person');
    return { verdict, label: VERDICTS[verdict], reasons, intent, score: points };
  }

  function fill(body, name) {
    const first = String(name || '').trim().split(/\s+/)[0];
    // Without a name (or with a bare phone number), drop the placeholder cleanly.
    if (!first || /^[+\d(]/.test(first)) return body.replace(/[ ,]*\{name\}/gi, '').replace(/\s+([!?.])/g, '$1');
    return body.replace(/\{name\}/gi, first);
  }

  function suggest(result, name) {
    return (SUGGESTIONS[result.intent] || SUGGESTIONS.general).map(([title, body]) => ({ title, text: fill(body, name) }));
  }

  // Parses the text file an iPhone Shortcut appends to: entries split by a line of "---",
  // each starting with "From: <sender>" (optional) followed by the message.
  function parseInbox(fileText) {
    return String(fileText || '')
      .split(/^\s*---\s*$/m)
      .map(chunk => chunk.trim())
      .filter(Boolean)
      .map(chunk => {
        const m = chunk.match(/^from:\s*(.*)\n?([\s\S]*)$/i);
        return m ? { from: m[1].trim(), text: m[2].trim() } : { from: '', text: chunk };
      })
      .filter(e => e.text);
  }

  const api = { classify, suggest, parseInbox, fill, VERDICTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Triage = api;
})(this);
