// --------------------------------------
// src/app/(auth)/actions.ts
//
// const authFormSchema               L19
// export type LoginActionState       L24
// status                             L25
// export const login                 L28
// export type RegisterActionState    L56
// status                             L57
// export const register              L66
// --------------------------------------

"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await auth.api.signInEmail({
      headers: await headers(),
      body: {
        email: validatedData.email,
        password: validatedData.password,
      },
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await auth.api.signUpEmail({
      headers: await headers(),
      body: {
        email: validatedData.email,
        password: validatedData.password,
        name: validatedData.email,
      },
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    const message = error instanceof Error ? error.message : "";
    if (message.includes("already exists") || message.includes("UNIQUE")) {
      return { status: "user_exists" };
    }

    return { status: "failed" };
  }
};
