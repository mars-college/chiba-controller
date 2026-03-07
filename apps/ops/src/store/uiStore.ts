import { create } from "zustand";

export type BuilderMode =
  | "ingest"
  | "media"
  | "mediaDetail"
  | "playlistEditor"
  | "blockEditor"
  | "channelEditor"
  | "profileEditor"
  | "mediaTable"
  | "playlist"
  | "block"
  | "channel"
  | "profile";

export type MainTab = "fleet" | "builder" | "devices";
export type FleetView = "table" | "workspace";
export type MediaLibrarySection =
  | "media"
  | "playlists"
  | "blocks"
  | "channels"
  | "profiles";
export type PlaylistLibraryView = "cards" | "table";
export type ContainerLibraryView = "cards" | "table";

type OpsUiState = {
  controlOpen: boolean;
  setControlOpen: (value: boolean) => void;
  toggleControlOpen: () => void;

  mainTab: MainTab;
  setMainTab: (value: MainTab) => void;

  builderTab: BuilderMode;
  setBuilderTab: (value: BuilderMode) => void;

  fleetView: FleetView;
  setFleetView: (value: FleetView) => void;

  mediaLibrarySection: MediaLibrarySection;
  setMediaLibrarySection: (value: MediaLibrarySection) => void;

  playlistLibraryView: PlaylistLibraryView;
  setPlaylistLibraryView: (value: PlaylistLibraryView) => void;

  blockLibraryView: ContainerLibraryView;
  setBlockLibraryView: (value: ContainerLibraryView) => void;

  channelLibraryView: ContainerLibraryView;
  setChannelLibraryView: (value: ContainerLibraryView) => void;

  profileLibraryView: ContainerLibraryView;
  setProfileLibraryView: (value: ContainerLibraryView) => void;

  mediaPickerOpen: boolean;
  setMediaPickerOpen: (value: boolean) => void;

  targetPickerOpen: boolean;
  setTargetPickerOpen: (value: boolean) => void;

  quickSendOpen: boolean;
  setQuickSendOpen: (value: boolean) => void;

  nodeEditorOpen: boolean;
  setNodeEditorOpen: (value: boolean) => void;

  assignTargetOpen: boolean;
  setAssignTargetOpen: (value: boolean) => void;
};

export const useOpsUiStore = create<OpsUiState>((set) => ({
  controlOpen: true,
  setControlOpen: (value) => set({ controlOpen: value }),
  toggleControlOpen: () => set((state) => ({ controlOpen: !state.controlOpen })),

  mainTab: "fleet",
  setMainTab: (value) => set({ mainTab: value }),

  builderTab: "ingest",
  setBuilderTab: (value) => set({ builderTab: value }),

  fleetView: "table",
  setFleetView: (value) => set({ fleetView: value }),

  mediaLibrarySection: "media",
  setMediaLibrarySection: (value) => set({ mediaLibrarySection: value }),

  playlistLibraryView: "cards",
  setPlaylistLibraryView: (value) => set({ playlistLibraryView: value }),

  blockLibraryView: "cards",
  setBlockLibraryView: (value) => set({ blockLibraryView: value }),

  channelLibraryView: "cards",
  setChannelLibraryView: (value) => set({ channelLibraryView: value }),

  profileLibraryView: "cards",
  setProfileLibraryView: (value) => set({ profileLibraryView: value }),

  mediaPickerOpen: false,
  setMediaPickerOpen: (value) => set({ mediaPickerOpen: value }),

  targetPickerOpen: false,
  setTargetPickerOpen: (value) => set({ targetPickerOpen: value }),

  quickSendOpen: false,
  setQuickSendOpen: (value) => set({ quickSendOpen: value }),

  nodeEditorOpen: false,
  setNodeEditorOpen: (value) => set({ nodeEditorOpen: value }),

  assignTargetOpen: false,
  setAssignTargetOpen: (value) => set({ assignTargetOpen: value }),
}));
