/**
 * Dependency-free domain primitives for the optional Mind toolkit.
 *
 * This catalog is intentionally content-first. UI, persistence, timers, and
 * personalization can consume it without changing the language or inventing
 * a separate model for each practice.
 */

export const mindPracticeCategories = [
  'breath',
  'grounding',
  'body-scan',
  'observing-thoughts',
  'compassion',
  'gratitude',
  'values',
  'perspective',
  'letting-go',
  'connection',
  'purpose',
  'short-reset',
] as const

const commonCaution =
  'If attention inward feels uncomfortable or overwhelming, return to ordinary surroundings or stop.'

const guidedStep = (
  id: string,
  title: string,
  instruction: string,
  durationSeconds?: number,
): MindPracticeStep => ({ id, title, instruction, ...(durationSeconds ? { durationSeconds } : {}) })

const moreMindPractices: readonly MindPractice[] = [
  {
    id: 'sensory-grounding',
    title: 'Sensory grounding',
    category: 'grounding',
    format: 'guided',
    durationMinutes: 3,
    summary: 'Use ordinary sensory details to reconnect with the room around you.',
    invitation: 'Let the outside world do some of the holding.',
    steps: [
      guidedStep('see', 'See', 'Name three neutral or supportive things you can see.', 60),
      guidedStep('feel', 'Feel', 'Notice two points of contact or texture.', 60),
      guidedStep('hear', 'Hear', 'Name one sound, then choose one practical next step.', 60),
    ],
    cautions: [commonCaution],
    tags: ['grounding', 'orientation', 'sensory'],
  },
  {
    id: 'five-things-outward',
    title: 'Five things outward',
    category: 'grounding',
    format: 'reflection',
    durationMinutes: 2,
    summary: 'Shift attention outward with a short, concrete inventory.',
    invitation: 'Specific and ordinary is enough.',
    steps: [
      guidedStep(
        'notice',
        'Notice',
        'Name one color, one shape, one sound, one texture, and one distance.',
        90,
      ),
      guidedStep(
        'settle',
        'Settle',
        'Which detail feels easiest to stay with for one more breath?',
        30,
      ),
    ],
    cautions: [commonCaution],
    tags: ['grounding', 'attention'],
  },
  {
    id: 'compassionate-boundary',
    title: 'Compassionate boundary',
    category: 'compassion',
    format: 'reflection',
    durationMinutes: 4,
    summary: 'Practice holding care for yourself alongside a clear limit.',
    invitation: 'A boundary can be kind, brief, and still real.',
    steps: [
      guidedStep('facts', 'Name the facts', 'What is being asked, expected, or assumed?', 60),
      guidedStep(
        'limit',
        'Name the limit',
        'What can you genuinely offer without overriding yourself?',
        90,
      ),
      guidedStep(
        'words',
        'Find the words',
        'Write one simple sentence that communicates the limit.',
        90,
      ),
    ],
    cautions: [commonCaution],
    tags: ['compassion', 'boundaries', 'communication'],
  },
  {
    id: 'self-criticism-distance',
    title: 'Distance from self-criticism',
    category: 'observing-thoughts',
    format: 'guided',
    durationMinutes: 3,
    summary: 'Notice a harsh thought without treating it as a final description of you.',
    invitation: 'You can take the thought seriously without taking it literally.',
    steps: [
      guidedStep('name', 'Name it', 'Write the thought in the shortest honest version.', 45),
      guidedStep('notice', 'Notice the effect', 'What feeling or urge follows it?', 75),
      guidedStep('widen', 'Widen the frame', 'Add one fact the harsh thought leaves out.', 60),
    ],
    cautions: [commonCaution],
    tags: ['thoughts', 'self-talk', 'perspective'],
  },
  {
    id: 'name-the-need',
    title: 'Name the need',
    category: 'values',
    format: 'reflection',
    durationMinutes: 3,
    summary: 'Translate a strong reaction into a need, value, or condition worth noticing.',
    invitation: 'A need is information, not an order.',
    steps: [
      guidedStep(
        'reaction',
        'Notice the reaction',
        'What happened and what did you feel pulled toward?',
        60,
      ),
      guidedStep(
        'need',
        'Name the need',
        'What condition, support, or value may be underneath?',
        60,
      ),
      guidedStep(
        'next',
        'Choose a next step',
        'What is one respectful way to respond to that information?',
        60,
      ),
    ],
    cautions: [commonCaution],
    tags: ['values', 'needs', 'choice'],
  },
  {
    id: 'choice-point',
    title: 'Choice point',
    category: 'values',
    format: 'guided',
    durationMinutes: 4,
    summary: 'Pause between an impulse and an action long enough to notice direction.',
    invitation: 'Small choices count even when the larger situation cannot change today.',
    steps: [
      guidedStep('away', 'Away', 'What action would move you away from what matters?', 60),
      guidedStep('toward', 'Toward', 'What action would move you toward what matters?', 90),
      guidedStep('choose', 'Choose', 'What is the smallest toward move available now?', 90),
    ],
    cautions: [commonCaution],
    tags: ['values', 'action', 'choice'],
  },
  {
    id: 'wider-frame',
    title: 'A wider frame',
    category: 'perspective',
    format: 'reflection',
    durationMinutes: 3,
    summary: 'Add context to a stuck story without arguing yourself out of what hurts.',
    invitation: 'More than one thing can be true at once.',
    steps: [
      guidedStep('story', 'Name the story', 'What conclusion is your mind offering?', 60),
      guidedStep('true', 'Keep what is true', 'Which part deserves to be taken seriously?', 60),
      guidedStep('more', 'Add more', 'What else is also true, possible, or not yet known?', 60),
    ],
    cautions: [commonCaution],
    tags: ['perspective', 'reflection', 'flexibility'],
  },
  {
    id: 'release-one-loop',
    title: 'Release one loop',
    category: 'letting-go',
    format: 'guided',
    durationMinutes: 3,
    summary: 'Recognize one repetitive mental loop and give it a temporary place to rest.',
    invitation:
      'Letting go can mean setting something down for ten minutes, not solving it forever.',
    steps: [
      guidedStep('loop', 'Name the loop', 'What question, image, or worry keeps returning?', 60),
      guidedStep(
        'hold',
        'Hold it lightly',
        'Say: “This is here, and I do not need to work it right now.”',
        60,
      ),
      guidedStep(
        'return',
        'Return',
        'Choose one sensory or practical anchor for the next minute.',
        60,
      ),
    ],
    cautions: [commonCaution],
    tags: ['letting-go', 'thoughts', 'reset'],
  },
  {
    id: 'connection-appreciation',
    title: 'Connection appreciation',
    category: 'connection',
    format: 'reflection',
    durationMinutes: 3,
    summary: 'Notice a relationship or community contribution without requiring contact today.',
    invitation: 'Remembering connection is already a form of connection.',
    steps: [
      guidedStep(
        'person',
        'Bring someone to mind',
        'Who or what has helped you feel less alone?',
        60,
      ),
      guidedStep(
        'received',
        'Notice what you received',
        'What quality, lesson, or support came through?',
        60,
      ),
      guidedStep('carry', 'Carry it forward', 'How might you carry one part of it into today?', 60),
    ],
    cautions: [commonCaution],
    tags: ['connection', 'gratitude', 'belonging'],
  },
  {
    id: 'purpose-in-the-ordinary',
    title: 'Purpose in the ordinary',
    category: 'purpose',
    format: 'guided',
    durationMinutes: 4,
    summary: 'Find meaning in a small act of care, maintenance, or participation.',
    invitation: 'Purpose does not have to feel grand to be real.',
    steps: [
      guidedStep('act', 'Name the act', 'What ordinary thing are you doing or considering?', 60),
      guidedStep('why', 'Notice why it matters', 'Who or what does this act serve?', 90),
      guidedStep(
        'continue',
        'Continue gently',
        'What would “enough” look like for this act today?',
        90,
      ),
    ],
    cautions: [commonCaution],
    tags: ['purpose', 'meaning', 'values'],
  },
  {
    id: 'one-minute-reset',
    title: 'One-minute reset',
    category: 'short-reset',
    format: 'guided',
    durationMinutes: 1,
    summary: 'A compact reset for noticing contact, breath, surroundings, and choice.',
    invitation: 'One minute can be useful without becoming another task to perform.',
    steps: [
      guidedStep('contact', 'Contact', 'Notice one point of support beneath you.', 20),
      guidedStep(
        'outward',
        'Outward',
        'Name one thing you can see and one sound you can hear.',
        20,
      ),
      guidedStep('choice', 'Choice', 'Choose the next small action or pause.', 20),
    ],
    cautions: [commonCaution],
    tags: ['reset', 'grounding', 'short'],
  },
] as const

export type MindPracticeCategory = (typeof mindPracticeCategories)[number]

export const mindPracticeFormats = ['guided', 'reflection'] as const
export type MindPracticeFormat = (typeof mindPracticeFormats)[number]

export interface MindPracticeStep {
  id: string
  title: string
  instruction: string
  durationSeconds?: number
}

export interface MindPractice {
  id: string
  title: string
  category: MindPracticeCategory
  format: MindPracticeFormat
  durationMinutes: number
  summary: string
  invitation: string
  steps: readonly MindPracticeStep[]
  cautions: readonly string[]
  tags: readonly string[]
}

const additionalMindPractices: readonly MindPractice[] = [
  {
    id: 'three-good-things',
    title: 'Three ordinary good things',
    category: 'gratitude',
    format: 'reflection',
    durationMinutes: 3,
    summary: 'Notice three specific moments, supports, or qualities without forcing positivity.',
    invitation: 'Small and ordinary counts. You do not need to feel grateful for everything.',
    steps: [
      guidedStep('one', 'One detail', 'Name one thing that was okay, useful, kind, or steady.', 60),
      guidedStep('two', 'A second detail', 'Name another detail and what it made possible.', 60),
      guidedStep('three', 'A third detail', 'Name one more detail you would like to remember.', 60),
    ],
    cautions: [commonCaution],
    tags: ['gratitude', 'reflection', 'secular'],
  },
  {
    id: 'values-next-step',
    title: 'Values to next step',
    category: 'values',
    format: 'reflection',
    durationMinutes: 4,
    summary: 'Move from a value you care about to one small action that fits today.',
    invitation: 'A value is a direction, not a demand for a perfect result.',
    steps: [
      guidedStep(
        'value',
        'Name the value',
        'What quality do you want to bring to this moment?',
        60,
      ),
      guidedStep(
        'choice',
        'Notice the choice',
        'What is one choice that would express it, even imperfectly?',
        90,
      ),
      guidedStep('step', 'Make it small', 'What is the next visible step you could take?', 90),
    ],
    cautions: [commonCaution],
    tags: ['values', 'choice', 'action'],
  },
  {
    id: 'compassionate-voice',
    title: 'A kinder inner voice',
    category: 'compassion',
    format: 'reflection',
    durationMinutes: 4,
    summary: 'Practice responding to a difficult moment with honesty and care.',
    invitation: 'Kindness does not require pretending that something is easy.',
    steps: [
      guidedStep(
        'facts',
        'Name the facts',
        'Describe what happened without adding a verdict about yourself.',
        75,
      ),
      guidedStep(
        'care',
        'Offer care',
        'What would you say to someone you care about in the same situation?',
        90,
      ),
      guidedStep(
        'support',
        'Choose support',
        'What support, boundary, or pause would help now?',
        75,
      ),
    ],
    cautions: [commonCaution],
    tags: ['compassion', 'self-talk', 'reflection'],
  },
  {
    id: 'thoughts-as-events',
    title: 'Thoughts as passing events',
    category: 'observing-thoughts',
    format: 'guided',
    durationMinutes: 3,
    summary: 'Notice a thought as something the mind is doing, rather than a command to obey.',
    invitation: 'You do not have to argue with the thought or make it disappear.',
    steps: [
      guidedStep('notice', 'Notice', 'Name the thought in a few words.', 45),
      guidedStep(
        'label',
        'Label',
        'Try “I am noticing the thought that…” and feel your feet or hands.',
        75,
      ),
      guidedStep(
        'return',
        'Return',
        'Let attention move to one sound, color, or practical next action.',
        60,
      ),
    ],
    cautions: [commonCaution],
    tags: ['thoughts', 'defusion', 'grounding'],
  },
  {
    id: 'body-kindness-scan',
    title: 'Body kindness scan',
    category: 'body-scan',
    format: 'guided',
    durationMinutes: 5,
    summary: 'Notice physical signals with permission to adjust, move, or stop.',
    invitation: 'Comfort matters more than completing the scan.',
    steps: [
      guidedStep('contact', 'Contact', 'Notice one place your body is supported.', 60),
      guidedStep('signal', 'Signal', 'Notice one sensation without needing to explain it.', 120),
      guidedStep(
        'choice',
        'Choice',
        'Ask what would be kind: stay, move, rest, or look outward.',
        120,
      ),
    ],
    cautions: [
      'Use external orientation instead if body attention is uncomfortable.',
      commonCaution,
    ],
    tags: ['body', 'kindness', 'choice'],
  },
  {
    id: 'connection-thread',
    title: 'A thread of connection',
    category: 'connection',
    format: 'reflection',
    durationMinutes: 3,
    summary:
      'Notice one relationship, place, or shared value that connects you to life around you.',
    invitation: 'Connection can be remembered privately; no message or performance is required.',
    steps: [
      guidedStep(
        'notice',
        'Notice',
        'Bring to mind one person, place, creature, or community.',
        60,
      ),
      guidedStep('receive', 'Receive', 'What have you received from that connection?', 60),
      guidedStep('offer', 'Offer', 'What small form of care might be possible later?', 60),
    ],
    cautions: [commonCaution],
    tags: ['connection', 'belonging', 'reflection'],
  },
] as const

export interface MindPracticeFilters {
  category?: MindPracticeCategory
  format?: MindPracticeFormat
  maxDurationMinutes?: number
  query?: string
  includeIds?: readonly string[]
  excludeIds?: readonly string[]
}

export interface MindPracticeRecommendationOptions extends MindPracticeFilters {
  limit?: number
  preferredIds?: readonly string[]
}

export const mindToolkitPrinciples = {
  optional: true,
  secular: true,
  usesStreaks: false,
  usesGuiltLanguage: false,
  scope: 'self-guided reflection and self-regulation, not diagnosis or treatment',
} as const

export const mindSafetyGuidance = {
  invitation:
    'These practices are optional invitations. Try what feels welcome, adapt the steps, or choose nothing today.',
  stop: 'You can pause, open your eyes, move, switch practices, or stop at any time.',
  scope:
    'These are self-guided reflection and self-regulation tools, not medical care, psychotherapy, or a diagnosis.',
  breathing:
    'There is no need to deepen, slow, or hold the breath. Comfortable breathing is enough.',
} as const

export const mindPracticeCatalog: readonly MindPractice[] = [
  {
    id: 'paced-breathing',
    title: 'Paced breathing',
    category: 'breath',
    format: 'guided',
    durationMinutes: 3,
    summary: 'A gentle rhythm for noticing the breath without trying to perform it perfectly.',
    invitation:
      'Let the pace be comfortable. You can return to your natural rhythm whenever you want.',
    steps: [
      guidedStep('arrive', 'Arrive', 'Notice the support beneath you and the breath as it is.', 30),
      guidedStep('inhale', 'Breathe in', 'Invite a smooth, easy inhale for about four counts.', 60),
      guidedStep('exhale', 'Breathe out', 'Allow an unhurried exhale for about four counts.', 60),
      guidedStep('close', 'Close', 'Release the counting and notice what is present now.', 30),
    ],
    cautions: [mindSafetyGuidance.breathing, commonCaution],
    tags: ['breathing', 'presence', 'beginner-friendly'],
  },
  {
    id: 'extended-exhale',
    title: 'Comfortable extended exhale',
    category: 'breath',
    format: 'guided',
    durationMinutes: 3,
    summary: 'A soft breathing pattern that gives the exhale a little more time than the inhale.',
    invitation: 'Use a small difference only if it feels easy; there is no target to reach.',
    steps: [
      guidedStep(
        'settle',
        'Settle',
        'Find a position that lets your ribs and belly move naturally.',
        30,
      ),
      guidedStep(
        'inhale',
        'Inhale gently',
        'Breathe in at an easy pace for about three counts.',
        45,
      ),
      guidedStep(
        'exhale',
        'Exhale softly',
        'Breathe out for about four counts, without squeezing or emptying forcefully.',
        75,
      ),
      guidedStep('release', 'Release', 'Stop counting and let your breathing be ordinary.', 30),
    ],
    cautions: [
      'Keep every breath comfortable. If you feel lightheaded, strained, or short of breath, return to natural breathing or stop.',
      commonCaution,
    ],
    tags: ['breathing', 'gentle', 'reset'],
  },
  {
    id: 'diaphragmatic-awareness',
    title: 'Breath and belly awareness',
    category: 'breath',
    format: 'guided',
    durationMinutes: 4,
    summary: 'A low-pressure exploration of where breathing is felt in the body.',
    invitation: 'There is nothing to fix. You are only noticing movement, contact, and ease.',
    steps: [
      guidedStep(
        'contact',
        'Find contact',
        'Notice where your body meets the chair, floor, or bed.',
        45,
      ),
      guidedStep(
        'notice',
        'Notice movement',
        'Place a hand on the chest or belly only if that feels comfortable, and observe movement.',
        90,
      ),
      guidedStep('allow', 'Allow', 'Let the breath choose its own size and speed.', 90),
      guidedStep(
        'close',
        'Close',
        'Move your attention to the room and continue with your next moment.',
        45,
      ),
    ],
    cautions: [
      'Touch is optional. Use sounds, feet, or the room as an anchor if body attention feels uncomfortable.',
      commonCaution,
    ],
    tags: ['breathing', 'body-awareness', 'choice'],
  },
  {
    id: 'five-four-three-two-one',
    title: '5–4–3–2–1 sensory grounding',
    category: 'grounding',
    format: 'guided',
    durationMinutes: 4,
    summary:
      'A present-moment inventory using ordinary sights, sensations, sounds, smells, and tastes.',
    invitation:
      'Use neutral details if pleasant details are hard to find. There is no need to feel different afterward.',
    steps: [
      guidedStep(
        'sight',
        'Look',
        'Name five things you can see, slowly and without judging them.',
        60,
      ),
      guidedStep(
        'touch',
        'Feel',
        'Notice four physical sensations, such as feet on the floor or fabric on your skin.',
        45,
      ),
      guidedStep('sound', 'Listen', 'Name three sounds, near or far.', 45),
      guidedStep(
        'smell',
        'Smell',
        'Notice two scents, or simply notice the quality of the air.',
        30,
      ),
      guidedStep('taste', 'Taste', 'Notice one taste, or the neutral sensation in your mouth.', 30),
      guidedStep(
        'orient',
        'Orient',
        'Name the place you are in and one thing you can choose for the next few minutes.',
        30,
      ),
    ],
    cautions: [
      'If a sense is unavailable or uncomfortable, skip it and use another neutral anchor.',
      commonCaution,
    ],
    tags: ['senses', 'grounding', 'orientation'],
  },
  {
    id: 'orienting-to-the-room',
    title: 'Orienting to the room',
    category: 'grounding',
    format: 'guided',
    durationMinutes: 2,
    summary:
      'A brief practice of looking around and recognizing present-day cues of place and time.',
    invitation:
      'Let your eyes move at a natural pace and take in only what feels neutral or supportive.',
    steps: [
      guidedStep(
        'look',
        'Look around',
        'Let your eyes rest on a few shapes, colors, and edges in the room.',
        45,
      ),
      guidedStep(
        'name',
        'Name the present',
        'Silently name where you are, the day or time of day, and one nearby support.',
        45,
      ),
      guidedStep('choose', 'Choose', 'Notice one small next choice that is kind or practical.', 30),
    ],
    cautions: [
      'Keep your eyes open if that feels safer. You can stop looking around at any point.',
      commonCaution,
    ],
    tags: ['grounding', 'orientation', 'short'],
  },
  {
    id: 'curious-body-scan',
    title: 'Curious body scan',
    category: 'body-scan',
    format: 'guided',
    durationMinutes: 6,
    summary:
      'A slow check of body sensations, with no requirement to relax, change, or explain them.',
    invitation:
      'Notice pressure, temperature, movement, or absence of sensation with simple curiosity.',
    steps: [
      guidedStep('support', 'Find support', 'Notice the places your body is supported.', 45),
      guidedStep(
        'lower',
        'Lower body',
        'Move attention through feet, legs, and hips. Notice whatever is easy to notice.',
        90,
      ),
      guidedStep(
        'center',
        'Center',
        'Notice the belly, ribs, and back without changing the breath.',
        90,
      ),
      guidedStep('upper', 'Upper body', 'Notice hands, arms, shoulders, neck, face, and head.', 90),
      guidedStep(
        'whole',
        'Whole body',
        'Let awareness include the whole body and the surrounding room.',
        45,
      ),
    ],
    cautions: [
      'You can skip any area, keep your eyes open, or use external sounds instead.',
      commonCaution,
    ],
    tags: ['body-awareness', 'mindfulness', 'curiosity'],
  },
  {
    id: 'observing-thoughts',
    title: 'Observing thoughts',
    category: 'observing-thoughts',
    format: 'guided',
    durationMinutes: 5,
    summary:
      'A practice of noticing thoughts as events in the mind without needing to solve or follow each one.',
    invitation:
      'You do not need an empty mind. When attention wanders, returning is part of the practice.',
    steps: [
      guidedStep(
        'anchor',
        'Choose an anchor',
        'Notice a sound, a point of contact, or the natural breath.',
        60,
      ),
      guidedStep(
        'notice',
        'Notice a thought',
        'When a thought appears, label it gently as thinking, planning, remembering, or another simple description.',
        120,
      ),
      guidedStep(
        'allow',
        'Let it be there',
        'Allow the thought to be present without arguing with it or acting on it right now.',
        90,
      ),
      guidedStep(
        'return',
        'Return',
        'Come back to the anchor with curiosity, as many times as needed.',
        30,
      ),
    ],
    cautions: [
      'If thoughts feel overwhelming, open your eyes and use a neutral external detail or stop.',
      commonCaution,
    ],
    tags: ['mindfulness', 'thoughts', 'nonjudgment'],
  },
  {
    id: 'self-compassion-pause',
    title: 'Self-compassion pause',
    category: 'compassion',
    format: 'guided',
    durationMinutes: 4,
    summary:
      'A grounded pause for acknowledging difficulty and choosing a more humane next response.',
    invitation:
      'Use words that sound believable to you. Neutral kindness is enough; you do not need to feel positive.',
    steps: [
      guidedStep(
        'acknowledge',
        'Acknowledge',
        'Name the difficulty plainly: this is hard, disappointing, painful, or tiring.',
        60,
      ),
      guidedStep(
        'common',
        'Remember common humanity',
        'Notice that struggle is part of being human, without comparing your experience to anyone else.',
        60,
      ),
      guidedStep(
        'kindness',
        'Offer kindness',
        'Ask what you would say to someone you care about, then choose one honest and supportive sentence for yourself.',
        90,
      ),
      guidedStep(
        'next',
        'Choose a next step',
        'Consider one small action that offers care or protection in this moment.',
        30,
      ),
    ],
    cautions: [
      'If direct self-kindness feels too far away, use factual and respectful language instead.',
      commonCaution,
    ],
    tags: ['compassion', 'self-talk', 'support'],
  },
  {
    id: 'ordinary-gratitude',
    title: 'Ordinary gratitude',
    category: 'gratitude',
    format: 'reflection',
    durationMinutes: 3,
    summary: 'A reflection on one small thing that was appreciated, noticed, or helpful today.',
    invitation:
      'Appreciation can coexist with difficulty. Choose something ordinary, or leave the prompt unanswered.',
    steps: [
      guidedStep(
        'notice',
        'Notice',
        'What is one ordinary detail, person, place, or moment you appreciated or found helpful?',
        60,
      ),
      guidedStep(
        'feel',
        'Stay with it',
        'What did you notice in your body, attention, or mood when you remembered it?',
        60,
      ),
      guidedStep(
        'carry',
        'Carry forward',
        'Is there a small way to make room for more of that quality, without turning it into a requirement?',
        60,
      ),
    ],
    cautions: [
      'You do not have to find a bright side or make meaning from something painful.',
      commonCaution,
    ],
    tags: ['gratitude', 'reflection', 'everyday'],
  },
  {
    id: 'values-in-this-moment',
    title: 'Values in this moment',
    category: 'values',
    format: 'reflection',
    durationMinutes: 4,
    summary: 'A quiet prompt to notice what matters and how it might guide one small choice.',
    invitation:
      'Values are directions, not tests. You can care about something without acting on it right now.',
    steps: [
      guidedStep(
        'matter',
        'Notice what matters',
        'What quality or relationship feels meaningful to you in this situation?',
        75,
      ),
      guidedStep(
        'person',
        'Notice the person you want to be',
        'How would you like to show up, even if the situation stays difficult?',
        75,
      ),
      guidedStep(
        'step',
        'Choose a small step',
        'What is one optional action that points in that direction and fits your actual capacity?',
        90,
      ),
    ],
    cautions: [
      'Do not use this prompt to pressure yourself past limits or to ignore safety and rest.',
      commonCaution,
    ],
    tags: ['values', 'meaning', 'choice'],
  },
  {
    id: 'widen-the-frame',
    title: 'Widen the frame',
    category: 'perspective',
    format: 'reflection',
    durationMinutes: 4,
    summary:
      'A structured pause for separating what is known from what is assumed and making room for more than one view.',
    invitation:
      'The goal is not to minimize the situation. It is to create a little more space around it.',
    steps: [
      guidedStep(
        'know',
        'What do I know?',
        'Name the observable facts, keeping interpretations separate.',
        60,
      ),
      guidedStep(
        'assume',
        'What am I assuming?',
        'Notice predictions, mind-reading, or conclusions that may be present.',
        60,
      ),
      guidedStep(
        'overlook',
        'What might I be overlooking?',
        'Consider one alternative explanation, need, or piece of context.',
        60,
      ),
      guidedStep(
        'next',
        'What is useful now?',
        'Choose the next small response that fits what you actually know.',
        60,
      ),
    ],
    cautions: [
      'Perspective-taking is not a reason to dismiss harm, urgency, or your own experience.',
      commonCaution,
    ],
    tags: ['perspective', 'curiosity', 'reflection'],
  },
  {
    id: 'put-down-for-now',
    title: 'Put down for now',
    category: 'letting-go',
    format: 'guided',
    durationMinutes: 4,
    summary: 'A practice for noticing what you are carrying and distinguishing care from control.',
    invitation:
      'Letting go here means loosening your grip for a moment, not stopping care or excusing harm.',
    steps: [
      guidedStep(
        'name',
        'Name what you are carrying',
        'Put a simple name to the thought, task, feeling, or uncertainty that is taking up space.',
        60,
      ),
      guidedStep(
        'control',
        'Notice control',
        'Ask what is within your influence, what is outside it, and what is not clear yet.',
        90,
      ),
      guidedStep(
        'put-down',
        'Put down for now',
        'Imagine setting aside one part you cannot act on in this moment.',
        60,
      ),
      guidedStep(
        'return',
        'Return to the present',
        'Choose one ordinary detail, task, or supportive action for the next few minutes.',
        30,
      ),
    ],
    cautions: [
      'This practice does not ask you to ignore danger, abandon boundaries, or stop taking needed action.',
      commonCaution,
    ],
    tags: ['acceptance', 'control', 'presence'],
  },
  {
    id: 'thread-of-connection',
    title: 'A thread of connection',
    category: 'connection',
    format: 'reflection',
    durationMinutes: 3,
    summary:
      'A reflection on people, places, communities, or living things that give a sense of connection.',
    invitation:
      'Connection can be close, distant, remembered, hoped for, or found in the world around you.',
    steps: [
      guidedStep(
        'notice',
        'Notice connection',
        'When or where did you feel connected, supported, or part of something today?',
        60,
      ),
      guidedStep(
        'remember',
        'Remember support',
        'Who or what has helped you, even in a small way?',
        60,
      ),
      guidedStep(
        'choose',
        'Choose an appropriate gesture',
        'Would it feel welcome to send a message, receive support, help someone, or simply rest with the memory?',
        60,
      ),
    ],
    cautions: [
      'You do not need to contact anyone. If connection feels unsafe or unavailable, include a place, activity, or future possibility instead.',
      commonCaution,
    ],
    tags: ['connection', 'support', 'relationships'],
  },
  {
    id: 'small-purpose',
    title: 'Small purpose',
    category: 'purpose',
    format: 'reflection',
    durationMinutes: 4,
    summary:
      'A gentle inquiry into what gives this day meaning or what you are quietly building toward.',
    invitation:
      'Purpose does not need to be grand. It can be a person, a responsibility, a curiosity, a practice, or a moment of care.',
    steps: [
      guidedStep('meaning', 'Notice meaning', 'What gave today meaning, even briefly?', 60),
      guidedStep(
        'forward',
        'Look forward',
        'What are you looking forward to, protecting, learning, or building toward?',
        75,
      ),
      guidedStep(
        'near',
        'Bring it near',
        'What small action or pause would honor that direction today?',
        75,
      ),
    ],
    cautions: [
      'Not knowing your purpose right now is allowed. Do not turn this reflection into a demand for certainty.',
      commonCaution,
    ],
    tags: ['purpose', 'meaning', 'direction'],
  },
  {
    id: 'one-minute-pause',
    title: 'One-minute pause',
    category: 'short-reset',
    format: 'guided',
    durationMinutes: 1,
    summary: 'A compact pause to notice body, breath, surroundings, and the next available choice.',
    invitation: 'Nothing has to change during this minute. You are making a little room to notice.',
    steps: [
      guidedStep('body', 'Body', 'Notice one point of contact or one physical sensation.', 15),
      guidedStep('breath', 'Breath', 'Notice one inhale and one exhale without changing them.', 20),
      guidedStep('room', 'Room', 'Notice one sound, color, or shape around you.', 15),
      guidedStep(
        'choose',
        'Choose',
        'Ask what would support the next minute, then take no action or one small action.',
        10,
      ),
    ],
    cautions: [
      'If inward attention is not useful, keep your eyes open and use the room as your anchor.',
      commonCaution,
    ],
    tags: ['pause', 'presence', 'quick'],
  },
  {
    id: 'release-and-reorient',
    title: 'Release and reorient',
    category: 'short-reset',
    format: 'guided',
    durationMinutes: 2,
    summary:
      'A brief reset using a physical release, an external orientation, and one practical next choice.',
    invitation: 'Use only the movement that feels comfortable; stillness is a valid option.',
    steps: [
      guidedStep(
        'release',
        'Release',
        'Unclench the jaw, lower the shoulders, or simply notice where effort is present.',
        30,
      ),
      guidedStep(
        'orient',
        'Orient',
        'Look toward a neutral or supportive detail and name where you are.',
        45,
      ),
      guidedStep(
        'choose',
        'Choose',
        'Identify one small practical action, pause, or request for support.',
        45,
      ),
    ],
    cautions: [
      'Skip any movement that causes discomfort. Stop if the reset makes you feel less steady.',
      commonCaution,
    ],
    tags: ['reset', 'orientation', 'movement'],
  },
] as const

export const fullMindPracticeCatalog: readonly MindPractice[] = [
  ...mindPracticeCatalog,
  ...additionalMindPractices,
  ...moreMindPractices,
]

export function findMindPractice(
  id: string,
  practices: readonly MindPractice[] = mindPracticeCatalog,
): MindPractice | undefined {
  return practices.find((practice) => practice.id === id)
}

export function filterMindPractices(
  filters: MindPracticeFilters = {},
  practices: readonly MindPractice[] = mindPracticeCatalog,
): MindPractice[] {
  const query = filters.query?.trim().toLocaleLowerCase()
  const includeIds = filters.includeIds ? new Set(filters.includeIds) : undefined
  const excludeIds = filters.excludeIds ? new Set(filters.excludeIds) : undefined

  return practices.filter((practice) => {
    if (filters.category && practice.category !== filters.category) return false
    if (filters.format && practice.format !== filters.format) return false
    if (
      filters.maxDurationMinutes !== undefined &&
      practice.durationMinutes > filters.maxDurationMinutes
    )
      return false
    if (includeIds && !includeIds.has(practice.id)) return false
    if (excludeIds?.has(practice.id)) return false
    if (query) {
      const searchable = [
        practice.title,
        practice.summary,
        practice.category,
        practice.format,
        ...practice.tags,
      ]
        .join(' ')
        .toLocaleLowerCase()
      if (!searchable.includes(query)) return false
    }
    return true
  })
}

export function recommendMindPractices(
  options: MindPracticeRecommendationOptions = {},
  practices: readonly MindPractice[] = mindPracticeCatalog,
): MindPractice[] {
  const limit = options.limit === undefined ? 3 : Math.max(0, Math.floor(options.limit))
  if (limit === 0) return []

  const preferredIds = options.preferredIds ?? []
  const preferredRank = new Map(preferredIds.map((id, index) => [id, index]))
  const filtered = filterMindPractices(options, practices)

  return filtered
    .map((practice, index) => ({
      practice,
      index,
      preferred: preferredRank.get(practice.id) ?? Number.MAX_SAFE_INTEGER,
      durationDistance:
        options.maxDurationMinutes === undefined
          ? 0
          : Math.abs(options.maxDurationMinutes - practice.durationMinutes),
    }))
    .sort(
      (left, right) =>
        left.preferred - right.preferred ||
        left.durationDistance - right.durationDistance ||
        left.index - right.index,
    )
    .slice(0, limit)
    .map(({ practice }) => practice)
}
