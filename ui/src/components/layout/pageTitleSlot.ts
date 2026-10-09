import { createContext } from "react";

/** The spot in the TopBar a page's PageHeader renders into. */
export const PageTitleSlotContext = createContext<HTMLElement | null>(null);
