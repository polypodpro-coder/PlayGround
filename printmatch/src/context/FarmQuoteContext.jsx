import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import { createFarmQuoteState, farmQuoteReducer, validateFarmQuoteInput } from "../lib/farmQuoteDrafts";

const FarmQuoteContext = createContext(null);

export function FarmQuoteProvider({ children }) {
  const [drafts, dispatch] = useReducer(farmQuoteReducer, undefined, createFarmQuoteState);
  const saveDraft = useCallback((job, input) => {
    // Validate synchronously so the form can report errors before reducer dispatch.
    validateFarmQuoteInput(job, input);
    dispatch({ type: "save", job, input, savedAt: Date.now() });
  }, []);
  const clearDraft = useCallback((jobId) => dispatch({ type: "clear", jobId }), []);
  const value = useMemo(() => ({ drafts, saveDraft, clearDraft }), [drafts, saveDraft, clearDraft]);
  return <FarmQuoteContext.Provider value={value}>{children}</FarmQuoteContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- Shared hook intentionally stays beside its provider.
export function useFarmQuotes() {
  const context = useContext(FarmQuoteContext);
  if (!context) throw new Error("useFarmQuotes must be used within FarmQuoteProvider");
  return context;
}


