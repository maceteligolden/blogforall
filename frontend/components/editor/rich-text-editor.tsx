"use client";

import { useEffect, useRef, useState } from "react";

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
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<{ index: number; data: any } | null>(null);
  const [imageProps, setImageProps] = useState({ width: "", height: "", caption: "" });

  useEffect(() => {
    if (typeof window === "undefined" || !editorRef.current) return;
    
    // Prevent duplicate initialization
    if (quillRef.current) return;
    
    // Clear any existing Quill toolbars and content
    if (editorRef.current) {
      // Remove any existing Quill toolbars
      const existingToolbars = editorRef.current.parentElement?.querySelectorAll('.ql-toolbar');
      existingToolbars?.forEach(toolbar => toolbar.remove());
      editorRef.current.innerHTML = "";
    }

    // Dynamically import Quill and modules
    Promise.all([
      import("quill"),
      import("quill-resize-module").catch(() => null),
      import("./image-with-caption"),
    ]).then(([QuillModule, ResizeModule, ImageWithCaptionModule]) => {
      const Quill = QuillModule.default;
      
      // Register resize module if available
      if (ResizeModule?.default) {
        try {
          Quill.register("modules/resize", ResizeModule.default);
        } catch (e) {
          console.warn("Could not register resize module:", e);
        }
      }
      
      // Register image with caption blot
      if (ImageWithCaptionModule?.createImageWithCaption) {
        ImageWithCaptionModule.createImageWithCaption(Quill);
      }

      // Check again to prevent race conditions
      if (quillRef.current || !editorRef.current) return;

      // Remove any existing Quill instances from the container
      const container = editorRef.current.parentElement;
      if (container) {
        const existingQuillContainers = container.querySelectorAll('.ql-container');
        existingQuillContainers.forEach(el => {
          if (el !== editorRef.current) {
            el.remove();
          }
        });
      }

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

                    // Insert the image with caption support
                    quillInstance.deleteText(index, 20);
                    quillInstance.insertEmbed(
                      index,
                      "imageWithCaption",
                      { url: imageUrl, caption: "" },
                      "user"
                    );
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
          ...(ResizeModule?.default ? {
            resize: {
              parchment: Quill.import("parchment"),
              modules: ["Resize", "DisplaySize", "Toolbar"],
            },
          } : {}),
        },
      });

      // Add click handler for images to edit properties
      quill.root.addEventListener("click", (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "IMG" || target.closest("figure.ql-image-with-caption")) {
          const figure = target.closest("figure.ql-image-with-caption") as HTMLElement;
          if (figure) {
            e.preventDefault();
            e.stopPropagation();

            // Get image data
            const img = figure.querySelector("img");
            const caption = figure.querySelector("figcaption");
            const data = {
              url: img?.getAttribute("src") || "",
              width: figure.getAttribute("data-width") || img?.style.width || "",
              height: figure.getAttribute("data-height") || img?.style.height || "",
              caption: caption?.textContent || figure.getAttribute("data-caption") || "",
            };

            // Find the index of this image in the editor
            const editor = quill.root;
            const figures = Array.from(editor.querySelectorAll("figure.ql-image-with-caption"));
            const index = figures.indexOf(figure);

            setEditingImage({ index, data });
            setImageProps({
              width: data.width.replace("px", "") || "",
              height: data.height.replace("px", "") || "",
              caption: data.caption || "",
            });
            setImageDialogOpen(true);
          }
        }
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
      // Clear the editor div on unmount
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
    };
  }, []);

  // Update content when value prop changes (but not from internal changes)
  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      quillRef.current.root.innerHTML = value;
    }
  }, [value]);

  const handleImagePropsSave = () => {
    if (!editingImage || !quillRef.current) return;

    const { index, data } = editingImage;
    const figures = Array.from(quillRef.current.root.querySelectorAll("figure.ql-image-with-caption"));
    const figure = figures[index] as HTMLElement;

    if (figure) {
      const img = figure.querySelector("img");
      const caption = figure.querySelector("figcaption");

      // Update width
      if (imageProps.width) {
        const width = imageProps.width.includes("px") ? imageProps.width : `${imageProps.width}px`;
        if (img) img.style.width = width;
        figure.setAttribute("data-width", width);
      } else {
        if (img) img.style.width = "";
        figure.removeAttribute("data-width");
      }

      // Update height
      if (imageProps.height) {
        const height = imageProps.height.includes("px") ? imageProps.height : `${imageProps.height}px`;
        if (img) img.style.height = height;
        figure.setAttribute("data-height", height);
      } else {
        if (img) img.style.height = "";
        figure.removeAttribute("data-height");
      }

      // Update caption
      if (caption) {
        caption.textContent = imageProps.caption || "";
        figure.setAttribute("data-caption", imageProps.caption || "");
      }

      // Trigger change
      const html = quillRef.current.root.innerHTML;
      onChange(html);
    }

    setImageDialogOpen(false);
    setEditingImage(null);
  };

  return (
    <div className={`rich-text-editor ${className || ""}`} ref={containerRef} style={{ height: "100%" }}>
      <div ref={editorRef} />
      
      {/* Image Properties Dialog */}
      {imageDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Image Properties</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Width (px)</label>
                <input
                  type="text"
                  value={imageProps.width}
                  onChange={(e) => setImageProps({ ...imageProps, width: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white"
                  placeholder="e.g., 800 or 50%"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Height (px)</label>
                <input
                  type="text"
                  value={imageProps.height}
                  onChange={(e) => setImageProps({ ...imageProps, height: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white"
                  placeholder="e.g., 600 or auto"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Caption</label>
                <textarea
                  value={imageProps.caption}
                  onChange={(e) => setImageProps({ ...imageProps, caption: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-gray-700 rounded text-white min-h-[80px]"
                  placeholder="Add a caption for this image..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setImageDialogOpen(false);
                  setEditingImage(null);
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImagePropsSave}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
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

        .rich-text-editor .ql-snow .ql-editor figure.ql-image-with-caption {
          margin: 1.5rem 0;
          text-align: center;
        }

        .rich-text-editor .ql-snow .ql-editor figure.ql-image-with-caption img {
          display: block;
          margin: 0 auto;
          border-radius: 0.5rem;
        }

        .rich-text-editor .ql-snow .ql-editor figure.ql-image-with-caption .image-caption {
          text-align: center;
          font-size: 0.875rem;
          color: #9ca3af;
          margin-top: 0.5rem;
          font-style: italic;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          min-height: 1.5rem;
        }

        .rich-text-editor .ql-snow .ql-editor figure.ql-image-with-caption .image-caption:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
        }

        .rich-text-editor .ql-snow .ql-editor figure.ql-image-with-caption .image-caption:focus {
          outline: 1px solid #3b82f6;
          outline-offset: 2px;
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
