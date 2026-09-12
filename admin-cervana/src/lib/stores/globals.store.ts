import type { User } from "$lib/types/auth.type";
import { writable } from "svelte/store";

export const userStore = writable<User | null>(null);