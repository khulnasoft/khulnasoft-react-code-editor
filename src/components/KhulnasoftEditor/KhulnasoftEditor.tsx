'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createConnectTransport } from '@connectrpc/connect-web';
import { createPromiseClient } from '@connectrpc/connect';
import { Status } from './Status';
import Editor, { EditorProps, Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor/esm/vs/editor/editor.api';
import { getDefaultValue } from './defaultValues';

import { LanguageServerService } from '../../api/proto/exa/language_server_pb/language_server_connect';
import { InlineCompletionProvider } from './InlineCompletionProvider';
import { KhulnasoftLogo } from '../KhulnasoftLogo/KhulnasoftLogo';
import { Document } from '../../models';
import { deepMerge } from '../../utils/merge';

export interface KhulnasoftEditorProps extends EditorProps {
  language: string;
  apiKey?: string;
  /**
   * Optional callback to detect when completions are accepted. Includes the accepted text for the completion.
   */
  onAutocomplete?: (acceptedText: string) => void;

  /**
   * Optional address of the Language Server. This should not be needed for most use cases. Defaults
   * to Khulnasoft's language server.
   */
  languageServerAddress?: string;

  /**
   * Optional list of other documents in the workspace. This can be used to provide additional
   * context to Khulnasoft beyond simply the current document. There is a limit of 10 medium sized
   * documents.
   */
  otherDocuments?: Document[];

  /**
   * Optional classname for the container.
   */
  containerClassName?: string;

  /**
   * Optional styles for the container.
   */
  containerStyle?: React.CSSProperties;

  /**
   * Optional multiline model threshold. Should not be needed for most use cases.
   * Numerical value between 0-1, higher = more single line, lower = more multiline,
   * 0.0 = only_multiline.
   */
  multilineModelThreshold?: number;
}

/**
 * Code editor that enables Khulnasoft AI suggestions in the editor.
 * The layout by default is width = 100% and height = 300px. These values can be overridden by passing in a string value to the width and/or height props.
 */
export const KhulnasoftEditor: React.FC<KhulnasoftEditorProps> = ({
  languageServerAddress = 'https://web-backend.khulnasoft.com',
  otherDocuments = [],
  containerClassName = '',
  containerStyle = {},
  ...props
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const inlineCompletionsProviderRef = useRef<InlineCompletionProvider | null>(
    null,
  );
  const [acceptedCompletionCount, setAcceptedCompletionCount] = useState(-1);
  const [completionCount, setCompletionCount] = useState(0);
  const [khulnasoftStatus, setKhulnasoftStatus] = useState(Status.INACTIVE);
  const [khulnasoftStatusMessage, setKhulnasoftStatusMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  const transport = useMemo(() => {
    return createConnectTransport({
      baseUrl: languageServerAddress,
      useBinaryFormat: true,
    });
  }, [languageServerAddress]);

  const grpcClient = useMemo(() => {
    return createPromiseClient(LanguageServerService, transport);
  }, [transport]);

  inlineCompletionsProviderRef.current = useMemo(() => {
    return new InlineCompletionProvider(
      grpcClient,
      setCompletionCount,
      setKhulnasoftStatus,
      setKhulnasoftStatusMessage,
      props.apiKey,
      props.multilineModelThreshold,
    );
  }, []);

  useEffect(() => {
    if (
      !editorRef?.current ||
      !monacoRef.current ||
      !inlineCompletionsProviderRef.current
    ) {
      return;
    }
    const monaco = monacoRef.current;

    const providerDisposable =
      monaco.languages.registerInlineCompletionsProvider(
        { pattern: '**' },
        inlineCompletionsProviderRef.current,
      );
    const completionDisposable = monaco.editor.registerCommand(
      'khulnasoft.acceptCompletion',
      (_: unknown, completionId: string, insertText: string) => {
        try {
          if (props.onAutocomplete) {
            props.onAutocomplete(insertText);
          }
          setAcceptedCompletionCount(acceptedCompletionCount + 1);
          inlineCompletionsProviderRef.current?.acceptedLastCompletion(
            completionId,
          );
        } catch (err) {
          console.log('Err');
        }
      },
    );

    return () => {
      providerDisposable.dispose();
      completionDisposable.dispose();
    };
  }, [
    editorRef?.current,
    monacoRef?.current,
    inlineCompletionsProviderRef?.current,
    acceptedCompletionCount,
    mounted,
  ]);

  const handleEditorDidMount = async (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMounted(true);

    // CORS pre-flight cache optimization.
    try {
      await grpcClient.getCompletions({});
    } catch (e) {
      // This is expected.
    }

    // Pass the editor instance to the user defined onMount prop.
    if (props.onMount) {
      props.onMount(editor, monaco);
    }
  };

  // Keep other documents up to date.
  useEffect(() => {
    inlineCompletionsProviderRef.current?.updateOtherDocuments(otherDocuments);
  }, [otherDocuments]);

  let defaultLanguageProps: EditorProps = {
    defaultLanguage: props.language,
    defaultValue: getDefaultValue(props.language),
  };

  const layout = {
    width: props.width || '100%',
    // The height is set to 300px by default. Otherwise, the editor when
    // rendered with the default value will not be visible.
    // The monaco editor's default height is 100% but it requires the user to
    // define a container with an explicit height.
    height: props.height || '300px',
  };

  return (
    <div
      style={{
        ...layout,
        position: 'relative',
        ...containerStyle,
      }}
      className={containerClassName}
    >
      <a
        href={'https://khulnasoft.com?referrer=khulnasoft-editor'}
        target="_blank"
        rel="noreferrer noopener"
      >
        <KhulnasoftLogo
          width={30}
          height={30}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
        />
      </a>
      <Editor
        {...defaultLanguageProps}
        {...props}
        width={layout.width}
        height={layout.height}
        onMount={handleEditorDidMount}
        options={deepMerge<editor.IStandaloneEditorConstructionOptions>(
          props.options,
          {
            scrollBeyondLastColumn: 0,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
            codeLens: false,
            // for resizing, but apparently might have "severe performance impact"
            // automaticLayout: true,
            minimap: {
              enabled: false,
            },
            quickSuggestions: false,
            folding: false,
            foldingHighlight: false,
            foldingImportsByDefault: false,
            links: false,
            fontSize: 14,
            wordWrap: 'on',
          },
        )}
      />
    </div>
  );
};
