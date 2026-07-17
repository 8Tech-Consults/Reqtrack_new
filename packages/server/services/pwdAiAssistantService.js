import { db } from "../config/config.js";

const DEFAULT_ACTIONS = [
  { label: "Help Me Login", prompt: "Help me log in" },
  { label: "Find Services", prompt: "Help me find services" },
  { label: "Find Jobs", prompt: "Help me find jobs" },
  { label: "PWD Form Help", prompt: "Help me fill PWD forms" },
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "you",
  "your",
  "about",
  "near",
  "nearby",
  "find",
  "help",
  "show",
  "please",
  "want",
  "need",
  "pwd",
  "pwds",
  "person",
  "persons",
  "people",
  "disability",
  "disabilities",
]);

const readEnv = (name, aliases = []) => {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
};

const providerConfigs = () => [
  {
    name: "groq",
    apiKey: readEnv("GROQ_API_KEY", ["GROK_API_KEY"]),
    endpoint:
      readEnv("GROQ_ENDPOINT", ["GROK_ENDPOINT"]) ||
      "https://api.groq.com/openai/v1/chat/completions",
    model:
      readEnv("GROQ_MODEL", ["GROK_MODEL"]) || "openai/gpt-oss-120b",
  },
  {
    name: "openai",
    apiKey: readEnv("OPENAI_API_KEY"),
    endpoint:
      readEnv("OPENAI_ENDPOINT") ||
      "https://api.openai.com/v1/chat/completions",
    model: readEnv("OPENAI_MODEL") || "gpt-4o-mini",
  },
];

export const chat = async (message, context = {}) => {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    return buildAssistantPayload(
      "Please type or say your question, and I will help you.",
      "fallback",
      DEFAULT_ACTIONS
    );
  }

  const recordContext = await buildRecordContext(cleanMessage);
  const providerResponse = await askProvider(cleanMessage, context, recordContext);

  if (providerResponse) {
    return buildAssistantPayload(
      providerResponse.content,
      hasRelevantRecords(recordContext) ? "model_rag" : "model",
      actionsForIntent(recordContext.intent),
      {
        provider: providerResponse.provider,
        model: providerResponse.model,
        intent: recordContext.intent,
        rag_records: countRelevantRecords(recordContext),
      }
    );
  }

  if (hasRelevantRecords(recordContext)) {
    return buildAssistantPayload(
      buildDbGroundedResponse(recordContext),
      "database",
      actionsForIntent(recordContext.intent),
      {
        provider: "",
        model: "",
        intent: recordContext.intent,
        rag_records: countRelevantRecords(recordContext),
      }
    );
  }

  return buildAssistantPayload(
    buildRuleBasedFallback(cleanMessage, recordContext.intent),
    "fallback",
    actionsForIntent(recordContext.intent),
    {
      provider: "",
      model: "",
      intent: recordContext.intent,
      rag_records: 0,
    }
  );
};

export const suggestActions = async (goal = "") => {
  const intent = detectIntent(goal);
  return {
    actions: actionsForIntent(intent),
  };
};

export const explainError = async (error = "", context = {}) => {
  const text = String(error || "").trim();
  const message = text
    ? `I can help with that error. It says: ${text}. Try the action again, check your internet connection, and confirm that all required fields are filled.`
    : "I can help with errors. Please share the exact message shown on the screen.";

  return buildAssistantPayload(message, "fallback", [
    { label: "Try Again", prompt: "Help me try this again" },
    { label: "Contact Support", prompt: "How do I contact support?" },
  ]);
};

export const summarize = async (text = "", mode = "simple") => {
  const cleanText = sanitizeAssistantText(text);
  if (!cleanText) {
    return buildAssistantPayload(
      "Please provide the information you want me to summarize.",
      "fallback",
      DEFAULT_ACTIONS
    );
  }

  const sentences = cleanText
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, mode === "short" ? 2 : 4);

  return buildAssistantPayload(
    sentences.length ? sentences.join(". ") + "." : cleanText,
    "fallback",
    DEFAULT_ACTIONS
  );
};

const askProvider = async (message, context, recordContext) => {
  for (const provider of providerConfigs()) {
    const response = await callChatProvider(provider, message, context, recordContext);
    if (response) return response;
  }
  return null;
};

const callChatProvider = async (provider, message, context, recordContext) => {
  if (!provider.apiKey) {
    // console.info(
    //   `AI provider ${provider.name} skipped because no API key is configured.`
    // );
    return null;
  }

  try {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(context, recordContext),
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `AI provider ${provider.name} failed with ${response.status}: ${body.slice(0, 300)}`
      );
      return null;
    }

    const json = await response.json();
    const content = extractProviderContent(json);
    return content
      ? {
          content: sanitizeAssistantText(content),
          provider: provider.name,
          model: provider.model,
        }
      : null;
  } catch (error) {
    console.error(`AI provider ${provider.name} error:`, error.message);
    return null;
  }
};

const extractProviderContent = (json) => {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.text || item?.content || "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
};

const buildSystemPrompt = (context, recordContext) => {
  const platform = context?.platform || "mobile";
  const language = context?.language || "English";
  const preferences = context?.accessibility_preferences || {};
  const textScale = preferences?.text_scale_factor
    ? `Text scale factor: ${preferences.text_scale_factor}.`
    : "";
  const highContrast = preferences?.high_contrast
    ? "The user prefers high contrast."
    : "";

  return [
    "You are the PWD Observatory assistant for persons with disabilities in Uganda.",
    "Use plain language, short steps, and a respectful practical tone.",
    "Do not make unsafe medical, legal, or financial claims. Say when you are unsure.",
    "Do not use markdown symbols such as headings, bullets, asterisks, or backticks.",
    `Platform: ${platform}. Language: ${language}. ${highContrast} ${textScale}`.trim(),
    buildRecordPrompt(recordContext),
  ]
    .filter(Boolean)
    .join("\n\n");
};

const buildRecordPrompt = (recordContext) => {
  if (!hasRelevantRecords(recordContext)) {
    return "No matching database records were found. You may answer from general knowledge and suggest what the user can try next.";
  }

  return [
    "Use the following database records when they answer the user's question. If the records are relevant, mention them directly and do not invent extra records.",
    JSON.stringify(recordContext.records, null, 2),
  ].join("\n");
};

const buildRecordContext = async (message) => {
  const intent = detectIntent(message);
  const keywords = extractKeywords(message);
  const records = {
    jobs: [],
    services: [],
    counselling: [],
    disabilities: [],
    districts: [],
    knowledge: [],
  };

  try {
    if (intent === "jobs") {
      records.jobs = await fetchJobRecords(keywords);
    } else if (intent === "services") {
      records.services = await fetchServiceProviderRecords(keywords);
    } else if (intent === "counselling") {
      records.counselling = await fetchCounsellingRecords(keywords);
    } else if (intent === "forms") {
      records.disabilities = await fetchDisabilityRecords();
      records.districts = await fetchDistrictRecords();
    } else if (intent === "knowledge") {
      records.knowledge = await fetchKnowledgeRecords(keywords);
    }
  } catch (error) {
    console.error("AI RAG record lookup failed:", error.message);
  }

  return { intent, keywords, records };
};

const detectIntent = (message = "") => {
  const text = message.toLowerCase();
  if (containsAny(text, ["job", "jobs", "work", "employment", "vacancy"])) {
    return "jobs";
  }
  if (
    containsAny(text, [
      "counsel",
      "counselling",
      "counseling",
      "therapy",
      "guidance",
      "mental",
    ])
  ) {
    return "counselling";
  }
  if (
    containsAny(text, ["service", "services", "provider", "support", "organisation"])
  ) {
    return "services";
  }
  if (
    containsAny(text, ["form", "register", "registration", "profile", "district"])
  ) {
    return "forms";
  }
  if (
    containsAny(text, [
      "project",
      "projects",
      "program",
      "programme",
      "training",
      "milestone",
      "beneficiary",
      "funding",
      "knowledge",
    ])
  ) {
    return "knowledge";
  }
  if (containsAny(text, ["login", "password", "sign in", "auth", "account"])) {
    return "auth";
  }
  return "general";
};

const extractKeywords = (message = "") =>
  Array.from(
    new Set(
      message
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    )
  ).slice(0, 6);

const fetchJobRecords = async (keywords) => {
  const { where, values } = buildKeywordWhere("j", [
    "title",
    "location",
    "hiring_firm",
    "minimum_academic_qualification",
    "required_experience",
    "description",
  ], keywords);
  const [rows] = await db.execute(
    `SELECT j.id, j.title, j.location, j.hiring_firm, j.deadline, j.status, j.how_to_apply
     FROM jobs AS j ${where} ORDER BY j.id DESC LIMIT 6`,
    values
  );
  return rows.map(normalizeRow);
};

const fetchServiceProviderRecords = async (keywords) => {
  const { where, values } = buildKeywordWhere("sp", [
    "name",
    "brief_profile",
    "services_offered",
    "districts_of_operation",
    "physical_address",
    "target_group",
    "disability_category",
  ], keywords);
  const [rows] = await db.execute(
    `SELECT sp.id, sp.name, sp.services_offered, sp.districts_of_operation, sp.physical_address, sp.telephone, sp.email, sp.is_verified
     FROM service_providers AS sp ${where} ORDER BY sp.id DESC LIMIT 6`,
    values
  );
  return rows.map(normalizeRow);
};

const fetchCounsellingRecords = async (keywords) => {
  const { where, values } = buildKeywordWhere("cc", [
    "name",
    "about",
    "address",
    "phone_number",
    "email",
    "skills",
    "fees_range",
  ], keywords);
  const [rows] = await db.execute(
    `SELECT cc.id, cc.name, cc.address, cc.phone_number, cc.email, cc.fees_range, cc.skills, cc.status
     FROM counselling_centres AS cc ${where} ORDER BY cc.id DESC LIMIT 6`,
    values
  );
  return rows.map(normalizeRow);
};

const fetchKnowledgeRecords = async (keywords) => {
  const { where, values } = buildKeywordWhere("p", [
    "title",
    "code",
    "description",
    "funding_source",
    "beneficiaries",
  ], keywords);
  const [rows] = await db.execute(
    `SELECT p.id, p.title, p.code, p.description, p.start_date, p.end_date, p.funding_source, p.beneficiaries
     FROM projects AS p ${where} ORDER BY p.id DESC LIMIT 6`,
    values
  );
  return rows.map(normalizeRow);
};

const fetchDisabilityRecords = async () => {
  const [rows] = await db.execute(
    "SELECT id, name FROM disabilities ORDER BY name ASC LIMIT 12"
  );
  return rows.map(normalizeRow);
};

const fetchDistrictRecords = async () => {
  const [rows] = await db.execute(
    "SELECT id, name FROM districts ORDER BY name ASC LIMIT 12"
  );
  return rows.map(normalizeRow);
};

const buildKeywordWhere = (alias, columns, keywords) => {
  if (!keywords.length) return { where: "WHERE 1=1", values: [] };

  const clauses = [];
  const values = [];
  for (const keyword of keywords) {
    for (const column of columns) {
      clauses.push(`${alias}.${column} LIKE ?`);
      values.push(`%${keyword}%`);
    }
  }

  return {
    where: `WHERE (${clauses.join(" OR ")})`,
    values,
  };
};

const normalizeRow = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      sanitizeAssistantText(value == null ? "" : String(value)),
    ])
  );

const hasRelevantRecords = (recordContext) =>
  Object.values(recordContext.records || {}).some(
    (items) => Array.isArray(items) && items.length > 0
  );

const countRelevantRecords = (recordContext) =>
  Object.values(recordContext.records || {}).reduce(
    (total, items) => total + (Array.isArray(items) ? items.length : 0),
    0
  );

const buildDbGroundedResponse = (recordContext) => {
  const { intent, records } = recordContext;

  if (intent === "jobs" && records.jobs.length) {
    return (
      "I found these job records in the database. " +
      records.jobs
        .map((job) => {
          const deadline = job.deadline ? ` Deadline: ${job.deadline}.` : "";
          const firm = job.hiring_firm ? ` at ${job.hiring_firm}` : "";
          const location = job.location ? ` Location: ${job.location}.` : "";
          return `${job.title}${firm}.${location}${deadline}`;
        })
        .join(" ")
    );
  }

  if (intent === "services" && records.services.length) {
    return (
      "I found these service providers in the database. " +
      records.services
        .map((service) => {
          const phone = service.telephone ? ` Phone: ${service.telephone}.` : "";
          const districts = service.districts_of_operation
            ? ` Districts: ${service.districts_of_operation}.`
            : "";
          const offered = service.services_offered
            ? ` Services: ${service.services_offered}.`
            : "";
          return `${service.name}.${offered}${districts}${phone}`;
        })
        .join(" ")
    );
  }

  if (intent === "counselling" && records.counselling.length) {
    return (
      "I found these counselling and guidance records in the database. " +
      records.counselling
        .map((centre) => {
          const address = centre.address ? ` Address: ${centre.address}.` : "";
          const phone = centre.phone_number
            ? ` Phone: ${centre.phone_number}.`
            : "";
          const fees = centre.fees_range ? ` Fees: ${centre.fees_range}.` : "";
          return `${centre.name}.${address}${phone}${fees}`;
        })
        .join(" ")
    );
  }

  if (intent === "forms") {
    const disabilities = records.disabilities.map((item) => item.name).join(", ");
    const districts = records.districts.map((item) => item.name).join(", ");
    return [
      "For PWD registration, prepare your personal details, phone number, district, and disability information.",
      disabilities ? `Available disability options include: ${disabilities}.` : "",
      districts ? `Available district options include: ${districts}.` : "",
      "If you are unsure, choose the closest correct option and ask support to verify it.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (intent === "knowledge" && records.knowledge.length) {
    return (
      "I found these project and knowledge records in the database. " +
      records.knowledge
        .map((item) => {
          const code = item.code ? ` Code: ${item.code}.` : "";
          const funding = item.funding_source
            ? ` Funding source: ${item.funding_source}.`
            : "";
          const beneficiaries = item.beneficiaries
            ? ` Beneficiaries: ${item.beneficiaries}.`
            : "";
          return `${item.title}.${code}${funding}${beneficiaries}`;
        })
        .join(" ")
    );
  }

  return buildRuleBasedFallback("", intent);
};

const buildRuleBasedFallback = (message, intent) => {
  if (intent === "auth") {
    return "To log in, enter your registered phone number and password. If the password is not working, use password reset or contact support for help.";
  }
  if (intent === "jobs") {
    return "I could not find matching job records right now. Open Jobs from the dashboard, then check the title, location, deadline, and how to apply.";
  }
  if (intent === "services") {
    return "I could not find matching service provider records right now. Open Service Providers from the dashboard and search by district, service, or organisation name.";
  }
  if (intent === "counselling") {
    return "I could not find matching counselling records right now. You can check Guidance and Counselling services from More Services, or contact a trusted local support organisation.";
  }
  if (intent === "forms") {
    return "For PWD forms, fill in your bio data, disability details, district information, and contact details. Use the correct phone number so your profile can be verified.";
  }
  return "I can help with login, jobs, services, PWD registration forms, counselling, accessibility settings, and information available in the observatory database.";
};

const actionsForIntent = (intent) => {
  if (intent === "jobs") {
    return [
      { label: "Find Jobs", prompt: "Show me available jobs" },
      { label: "How to Apply", prompt: "Explain how to apply for jobs" },
      { label: "Service Support", prompt: "Find service providers for work support" },
    ];
  }
  if (intent === "services") {
    return [
      { label: "Find Services", prompt: "Help me find services nearby" },
      { label: "By District", prompt: "Find service providers by district" },
      { label: "Contact Help", prompt: "How do I contact a provider?" },
    ];
  }
  if (intent === "forms") {
    return [
      { label: "Form Help", prompt: "Help me fill PWD registration forms" },
      { label: "District Help", prompt: "Help me choose my district" },
      { label: "Disability Help", prompt: "Help me choose a disability type" },
    ];
  }
  if (intent === "counselling") {
    return [
      { label: "Find Counselling", prompt: "Find counselling services" },
      { label: "Mental Health", prompt: "Explain mental health support options" },
      { label: "Emergency Help", prompt: "What should I do in an emergency?" },
    ];
  }
  return DEFAULT_ACTIONS;
};

const buildAssistantPayload = (
  message,
  source,
  actions = DEFAULT_ACTIONS,
  metadata = {}
) => {
  const cleanMessage = sanitizeAssistantText(message);
  return {
    message: cleanMessage,
    simple_text: cleanMessage,
    tts_text: cleanMessage,
    source,
    confidence: source === "model_rag" || source === "database" ? 0.84 : 0.64,
    actions,
    ...metadata,
  };
};

const containsAny = (text, needles) => needles.some((needle) => text.includes(needle));

const sanitizeAssistantText = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
