import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------
// src/db/schema.ts
//
// export const user             L39
// export type User              L51
// export const session          L53
// export type Session           L66
// export const account          L68
// export type Account           L86
// export const verification     L88
// export type Verification      L97
// export const chat             L99
// export type Chat             L111
// export const message         L113
// export type DBMessage        L124
// export const vote            L126
// export type Vote             L142
// export const document        L144
// export type Document         L163
// export const suggestion      L165
// export type Suggestion       L189
// export const stream          L191
// export type Stream           L207
// ---------------------------------

export const user = pgTable("users", {
  id: text("id").primaryKey(),
  email: varchar("email", { length: 64 }).notNull(),
  password: text("password"),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  telegramId: bigint("telegramId", { mode: "bigint" }).unique(),
  telegramUsername: text("telegramUsername"),
  instagramId: text("instagramId").unique(),
  instagramUsername: text("instagramUsername"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const session = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
});

export type Session = InferSelectModel<typeof session>;

export const account = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Account = InferSelectModel<typeof account>;

export const verification = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

export type Verification = InferSelectModel<typeof verification>;

export const chat = pgTable("chats", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("messages", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "votes",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "documents",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "suggestions",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "streams",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const cycle = pgTable("cycles", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  periodStart: timestamp("periodStart").notNull(),
  cycleLength: integer("cycleLength").notNull().default(28),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Cycle = InferSelectModel<typeof cycle>;

export const scan = pgTable("scans", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  conversationId: uuid("conversationId").references(() => chat.id),
  scanType: text("scanType").notNull().default("face"),
  imageUrl: text("imageUrl"),
  results: jsonb("results").notNull(),
  cycleDay: integer("cycleDay"),
  cyclePhase: text("cyclePhase"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Scan = InferSelectModel<typeof scan>;

// Simple plain-text message table for Telegram conversations.
// No JSON parts, no complex formats — just text in, text out.
export const telegramMessage = pgTable("telegram_messages", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  telegramChatId: bigint("telegramChatId", { mode: "number" }).notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(), // plain text, no JSON
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type TelegramMessage = InferSelectModel<typeof telegramMessage>;

// Simple plain-text message table for Instagram conversations.
// Mirrors telegram_messages but uses string IDs (Instagram IDs are page-scoped strings).
export const instagramMessage = pgTable("instagram_messages", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  instagramSenderId: text("instagramSenderId").notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(), // plain text, no JSON
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type InstagramMessage = InferSelectModel<typeof instagramMessage>;

// ---- Memory system (Sprint 2) ----

export const memory = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["identity", "health", "preference", "moment", "context"],
    }).notNull(),
    key: text("key"),
    value: text("value").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    expiresAt: timestamp("expiresAt"),
  },
  (table) => ({
    userCategoryIdx: index("memory_user_category_idx").on(
      table.userId,
      table.category,
    ),
    expiresIdx: index("memory_expires_idx").on(table.expiresAt),
    // NULLs are distinct in PG unique constraints, so rows with key=NULL
    // (health, moment, context) won't conflict with each other.
    userCategoryKeyUnique: uniqueIndex("memory_user_category_key_unique").on(
      table.userId,
      table.category,
      table.key,
    ),
  }),
);

export type Memory = InferSelectModel<typeof memory>;

// ---- Proactive messaging log (Sprint 3B) ----

export const proactiveLog = pgTable(
  "proactive_log",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["product_followup", "scan_nudge", "weather_tip"],
    }).notNull(),
    referenceId: text("referenceId"),
    message: text("message").notNull(),
    sentAt: timestamp("sentAt").notNull().defaultNow(),
  },
  (table) => ({
    userTypeRefIdx: index("proactive_user_type_ref_idx").on(
      table.userId,
      table.type,
      table.referenceId,
    ),
    userSentIdx: index("proactive_user_sent_idx").on(
      table.userId,
      table.sentAt,
    ),
  }),
);

export type ProactiveLog = InferSelectModel<typeof proactiveLog>;

// ---- Link codes for web ↔ Telegram account linking (Sprint 5B) ----

export const linkCode = pgTable("link_codes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type LinkCode = typeof linkCode.$inferSelect;

// ---- Onboarding flow state (Noor Telegram) ----

export const onboarding = pgTable("onboardings", {
  userId: text("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("awaiting_intent"),
  answers: jsonb("answers").notNull().default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Onboarding = InferSelectModel<typeof onboarding>;

// ---- Onboarding answer types ----

export interface OnboardingAnswers {
  name?: string;
  skinType?: string;
  routine?: string;
  concern?: string;
  allergies?: string[];
}

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  companion: varchar("companion", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Waitlist = InferSelectModel<typeof waitlist>;
