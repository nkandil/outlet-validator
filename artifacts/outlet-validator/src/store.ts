import type { WorkBook } from "xlsx";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConfirmedMapping, Outlet, OutletValidation, RowData, SessionConfig, SessionDetail, SyncState, UserLocation, WizardStep } from "./types";
import { defaultMapping } from "./types";

interface OutletValidatorState {
  currentStep: WizardStep;
  workbook: WorkBook | null;
  sheetNames: string[];
  selectedSheet: string;
  rawHeaders: string[];
  rawRows: RowData[];
  fileName: string;
  sessionId: string | null;
  sessionName: string;
  radiusKm: number;
  confirmedMapping: ConfirmedMapping;
  visibleFields: string[];
  fieldsToVerify: string[];
  reviewerName: string;
  outlets: Outlet[];
  userLocation: UserLocation | null;
  validations: Record<string, OutletValidation>;
  selectedOutletKey: string | null;
  syncState: SyncState;
  syncError: string;
  pendingSync: boolean;
  setStep: (step: WizardStep) => void;
  setUpload: (upload: {
    workbook: WorkBook;
    sheetNames: string[];
    selectedSheet: string;
    rawHeaders: string[];
    rawRows: RowData[];
    fileName: string;
  }) => void;
  setSelectedSheetRows: (selectedSheet: string, rawHeaders: string[], rawRows: RowData[]) => void;
  setConfirmedMapping: (mapping: ConfirmedMapping) => void;
  setVisibleFields: (fields: string[]) => void;
  setFieldsToVerify: (fields: string[]) => void;
  setReviewerName: (name: string) => void;
  setOutlets: (outlets: Outlet[]) => void;
  setUserLocation: (location: UserLocation | null) => void;
  setSessionMeta: (id: string | null, name: string) => void;
  setRadiusKm: (radiusKm: number) => void;
  selectOutlet: (outletKey: string | null) => void;
  saveValidationLocal: (outletKey: string, validation: OutletValidation) => void;
  setSyncState: (state: SyncState, error?: string) => void;
  getSessionConfig: () => SessionConfig;
  hydrateSession: (detail: SessionDetail) => void;
  reset: () => void;
}

const initialData = {
  currentStep: 0 as WizardStep,
  workbook: null,
  sheetNames: [],
  selectedSheet: "",
  rawHeaders: [],
  rawRows: [],
  fileName: "",
  sessionId: null,
  sessionName: "",
  radiusKm: 5,
  confirmedMapping: defaultMapping,
  visibleFields: [],
  fieldsToVerify: [],
  reviewerName: "",
  outlets: [],
  userLocation: null,
  validations: {},
  selectedOutletKey: null,
  syncState: "idle" as SyncState,
  syncError: "",
  pendingSync: false
};

export const useOutletStore = create<OutletValidatorState>()(
  persist(
    (set, get) => ({
      ...initialData,
      setStep: (currentStep) => set({ currentStep }),
      setUpload: (upload) =>
        set({
          ...upload,
          confirmedMapping: defaultMapping,
          outlets: [],
          visibleFields: [],
          fieldsToVerify: [],
          validations: {},
          sessionId: null,
          sessionName: "",
          radiusKm: 5,
          syncState: "idle",
          pendingSync: false
        }),
      setSelectedSheetRows: (selectedSheet, rawHeaders, rawRows) => set({ selectedSheet, rawHeaders, rawRows }),
      setConfirmedMapping: (confirmedMapping) => set({ confirmedMapping }),
      setVisibleFields: (visibleFields) => set({ visibleFields }),
      setFieldsToVerify: (fieldsToVerify) => set({ fieldsToVerify }),
      setReviewerName: (reviewerName) => set({ reviewerName }),
      setOutlets: (outlets) => set({ outlets }),
      setUserLocation: (userLocation) => set({ userLocation }),
      setSessionMeta: (sessionId, sessionName) => set({ sessionId, sessionName }),
      setRadiusKm: (radiusKm) => set({ radiusKm }),
      selectOutlet: (selectedOutletKey) => set({ selectedOutletKey }),
      saveValidationLocal: (outletKey, validation) =>
        set((state) => ({
          validations: { ...state.validations, [outletKey]: validation },
          syncState: "saved-local",
          pendingSync: true,
          syncError: ""
        })),
      setSyncState: (syncState, syncError = "") => set({ syncState, syncError, pendingSync: syncState === "failed" }),
      getSessionConfig: () => {
        const state = get();
        return {
          confirmedMapping: state.confirmedMapping,
          visibleFields: state.visibleFields,
          fieldsToVerify: state.fieldsToVerify,
          reviewerName: state.reviewerName,
          rawHeaders: state.rawHeaders
        };
      },
      hydrateSession: (detail) =>
        set({
          ...initialData,
          currentStep: 7,
          sessionId: detail.id,
          sessionName: detail.name,
          radiusKm: detail.radiusKm ?? 5,
          fileName: detail.fileName,
          rawHeaders: detail.config.rawHeaders,
          confirmedMapping: detail.config.confirmedMapping,
          visibleFields: detail.config.visibleFields,
          fieldsToVerify: detail.config.fieldsToVerify,
          reviewerName: detail.config.reviewerName,
          outlets: detail.outlets,
          validations: detail.validations,
          syncState: "synced"
        }),
      reset: () => set({ ...initialData })
    }),
    {
      name: "outlet-validator-session",
      partialize: (state) => ({
        sheetNames: state.sheetNames,
        selectedSheet: state.selectedSheet,
        rawHeaders: state.rawHeaders,
        rawRows: state.rawRows,
        fileName: state.fileName,
        sessionId: state.sessionId,
        sessionName: state.sessionName,
        radiusKm: state.radiusKm,
        confirmedMapping: state.confirmedMapping,
        visibleFields: state.visibleFields,
        fieldsToVerify: state.fieldsToVerify,
        reviewerName: state.reviewerName,
        outlets: state.outlets,
        userLocation: state.userLocation,
        validations: state.validations,
        pendingSync: state.pendingSync
      })
    }
  )
);
