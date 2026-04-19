import { KNOWLEDGE_CHANGED, listKnowledgeSorted } from "./knowledgeStorage";
import { useRemoteList } from "./useRemoteList";

export function useKnowledgeList() {
  return useRemoteList(KNOWLEDGE_CHANGED, listKnowledgeSorted);
}
