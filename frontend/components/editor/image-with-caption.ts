// Custom Quill blot for images with captions
export function createImageWithCaption(QuillInstance: any) {
  // Safely import BlockEmbed with error handling
  let BlockEmbed: any;
  try {
    BlockEmbed = QuillInstance.import("blots/block/embed");
    if (!BlockEmbed || typeof BlockEmbed !== "function") {
      throw new Error("BlockEmbed not found");
    }
  } catch (error) {
    console.error("Error importing BlockEmbed:", error);
    // Fallback: create a basic BlockEmbed class
    BlockEmbed = class {
      static create() {
        return document.createElement("div");
      }
    };
  }

  class ImageWithCaption extends BlockEmbed {
    static blotName = "imageWithCaption";
    static tagName = "figure";
    static className = "ql-image-with-caption";

    static create(value: { url: string; width?: string; height?: string; caption?: string }) {
      const node = super.create() as HTMLElement;
      node.setAttribute("contenteditable", "false");

      // Create image element
      const img = document.createElement("img");
      img.setAttribute("src", value.url);
      img.setAttribute("alt", value.caption || "");
      if (value.width) {
        img.style.width = value.width;
      }
      if (value.height) {
        img.style.height = value.height;
      }
      img.style.display = "block";
      img.style.margin = "0 auto";
      img.style.cursor = "pointer";

      // Create caption element
      const caption = document.createElement("figcaption");
      caption.className = "image-caption";
      caption.contentEditable = "true";
      caption.textContent = value.caption || "";
      caption.style.textAlign = "center";
      caption.style.fontSize = "0.875rem";
      caption.style.color = "#9ca3af";
      caption.style.marginTop = "0.5rem";
      caption.style.fontStyle = "italic";
      caption.setAttribute("data-placeholder", "Add a caption...");

      // Handle caption editing
      caption.addEventListener("blur", () => {
        const captionText = caption.textContent || "";
        const data = ImageWithCaption.value(node);
        data.caption = captionText;
        // Update the data attribute
        node.setAttribute("data-caption", captionText);
      });

      // Handle caption placeholder
      caption.addEventListener("focus", () => {
        if (caption.textContent === "") {
          caption.textContent = "";
        }
      });

      node.appendChild(img);
      node.appendChild(caption);

      // Store data in data attributes
      node.setAttribute("data-url", value.url);
      if (value.width) node.setAttribute("data-width", value.width);
      if (value.height) node.setAttribute("data-height", value.height);
      if (value.caption) node.setAttribute("data-caption", value.caption);

      return node;
    }

    static value(node: HTMLElement) {
      const img = node.querySelector("img");
      const caption = node.querySelector("figcaption");
      return {
        url: img?.getAttribute("src") || node.getAttribute("data-url") || "",
        width: node.getAttribute("data-width") || img?.style.width || undefined,
        height: node.getAttribute("data-height") || img?.style.height || undefined,
        caption: caption?.textContent || node.getAttribute("data-caption") || "",
      };
    }

    static formats(node: HTMLElement) {
      return {
        width: node.getAttribute("data-width") || undefined,
        height: node.getAttribute("data-height") || undefined,
        caption: node.getAttribute("data-caption") || undefined,
      };
    }
  }

  // Register the custom blot
  QuillInstance.register(ImageWithCaption);
  
  return ImageWithCaption;
}
