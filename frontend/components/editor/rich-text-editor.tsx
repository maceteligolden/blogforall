"use client";

import { useEffect, useRef } from "react";

// Import CSS
if (typeof window !== "undefined") {
  require("quill/dist/quill.snow.css");
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !editorRef.current || quillRef.current) return;

    // Dynamically import Quill
    import("quill").then((QuillModule) => {
      const Quill = QuillModule.default;

      // Initialize Quill
      const quill = new Quill(editorRef.current!, {
        theme: "snow",
        placeholder: placeholder || "Start writing your blog post...",
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, 4, 5, 6, false] }],
              [{ size: ["small", false, "large", "huge"] }],
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ script: "sub" }, { script: "super" }],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ indent: "-1" }, { indent: "+1" }],
              [{ align: [] }],
              ["blockquote", "code-block"],
              ["link", "image", "video"],
              ["clean"],
            ],
            handlers: {
              image: function (this: any) {
                const quillInstance = quillRef.current;
                if (!quillInstance) return;

                const input = document.createElement("input");
                input.setAttribute("type", "file");
                input.setAttribute("accept", "image/*");
                input.click();

                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;

                  const range = quillInstance.getSelection(true);
                  const index = range ? range.index : quillInstance.getLength();

                  // Create a placeholder
                  quillInstance.insertText(index, "Uploading image...\n", "user");
                  quillInstance.setSelection(index + 20);

                  try {
                    // Call the image upload handler
                    const imageUrl = await new Promise<string>((resolve, reject) => {
                      const event = new CustomEvent("upload-image", {
                        detail: { file, resolve, reject },
                      });
                      window.dispatchEvent(event);
                    });

                    // Insert the image
                    quillInstance.deleteText(index, 20);
                    quillInstance.insertEmbed(index, "image", imageUrl, "user");
                    quillInstance.setSelection(index + 1);
                  } catch (error) {
                    quillInstance.deleteText(index, 20);
                    quillInstance.insertText(index, "Image upload failed\n", "user");
                    console.error("Image upload failed:", error);
                  }
                };
              },
            },
          },
          clipboard: {
            matchVisual: false,
          },
        },
      });

      quillRef.current = quill;

      // Set initial content
      if (value) {
        quill.root.innerHTML = value;
      }

      // Listen for text changes
      quill.on("text-change", () => {
        const html = quill.root.innerHTML;
        onChange(html);
      });
    });

    return () => {
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, []);

  // Update content when value prop changes (but not from internal changes)
  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      quillRef.current.root.innerHTML = value;
    }
  }, [value]);

  return (
    <div className={`rich-text-editor ${className || ""}`} ref={containerRef} style={{ height: "100%" }}>
      <div ref={editorRef} style={{ height: "100%", display: "flex", flexDirection: "column" }} />
      <style jsx global>{`
        .rich-text-editor {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .rich-text-editor .ql-container {
          font-family: inherit;
          font-size: 16px;
          flex: 1;
          background-color: #000;
          color: #fff;
          border-color: #374151;
        }

        .rich-text-editor .ql-editor {
          min-height: 100%;
          color: #fff;
        }

        .rich-text-editor .ql-editor.ql-blank::before {
          color: #6b7280;
          font-style: normal;
        }

        .rich-text-editor .ql-toolbar {
          background-color: #111827;
          border-color: #374151;
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
        }

        .rich-text-editor .ql-toolbar .ql-stroke {
          stroke: #d1d5db;
        }

        .rich-text-editor .ql-toolbar .ql-fill {
          fill: #d1d5db;
        }

        .rich-text-editor .ql-toolbar .ql-picker-label {
          color: #d1d5db;
        }

        .rich-text-editor .ql-toolbar button:hover,
        .rich-text-editor .ql-toolbar button.ql-active {
          background-color: #374151;
        }

        .rich-text-editor .ql-toolbar .ql-picker-options {
          background-color: #111827;
          border-color: #374151;
        }

        .rich-text-editor .ql-toolbar .ql-picker-item {
          color: #d1d5db;
        }

        .rich-text-editor .ql-toolbar .ql-picker-item:hover {
          background-color: #374151;
        }

        .rich-text-editor .ql-snow .ql-picker {
          color: #d1d5db;
        }

        .rich-text-editor .ql-snow .ql-stroke.ql-thin {
          stroke: #d1d5db;
        }

        .rich-text-editor .ql-snow a {
          color: #60a5fa;
        }

        .rich-text-editor .ql-snow .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }

        .rich-text-editor .ql-snow .ql-editor blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #9ca3af;
          font-style: italic;
        }

        .rich-text-editor .ql-snow .ql-editor pre.ql-syntax {
          background-color: #1f2937;
          color: #10b981;
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1rem 0;
          overflow-x: auto;
        }

        .rich-text-editor .ql-snow .ql-editor h1,
        .rich-text-editor .ql-snow .ql-editor h2,
        .rich-text-editor .ql-snow .ql-editor h3,
        .rich-text-editor .ql-snow .ql-editor h4,
        .rich-text-editor .ql-snow .ql-editor h5,
        .rich-text-editor .ql-snow .ql-editor h6 {
          color: #fff;
          font-weight: bold;
          margin: 1rem 0;
        }

        .rich-text-editor .ql-snow .ql-editor ul,
        .rich-text-editor .ql-snow .ql-editor ol {
          padding-left: 2rem;
          margin: 1rem 0;
        }

        .rich-text-editor .ql-snow .ql-editor li {
          margin: 0.5rem 0;
        }

        .rich-text-editor .ql-snow .ql-editor p {
          margin: 0.75rem 0;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
