/**
 * The Workshop's public face. The game imports only from here:
 *
 *   import { Workshop, type WorkshopProps } from "@/components/workshop";
 *
 * `Workshop` is a small stand-in that downloads the real editor the first
 * time it is shown, so none of the editor's code is in the game's first
 * download.
 */
export { Workshop, preloadWorkshop } from "./LazyWorkshop";
export type { ForgeRewards, WorkshopExtraTab, WorkshopProps, WorkshopTabContext } from "./types";
