import {
  Completion,
  CompletionSource,
} from '../../api/proto/exa/khulnasoft_common_pb/khulnasoft_common_pb';

export type CompletionAndRange = {
  completion: Completion;
  range: Range;
};

export type CompletionDetailsWrapper = {
  index: number;
  document: Document;
  completion: Completion;
  annotatedCompletionLines: string[];
  prompt: string;
};

export type CompletionsAndMetadata = {
  completions: Completion[];
  source: CompletionSource;
  latencyMs: number;
  promptId: string;
  timestamp: number;
};
