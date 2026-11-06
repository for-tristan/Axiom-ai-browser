import React from 'react';
import type { ChangeEvent, RefObject } from 'react';
import type { ColorTheme } from '../../types/browser';

interface CustomizePanelProps {
  customizeOpen: boolean;
  customizeRef: RefObject<HTMLDivElement>;
  bgImage: string;
  bgColor: string;
  previewBackground: string;
  availableThemes?: ColorTheme[];
  onClose: () => void;
  onColorChoose: (id: string) => void;
  onBgChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

export const CustomizePanel: React.FC<CustomizePanelProps> = ({
  customizeOpen,
  customizeRef,
  bgImage,
  bgColor,
  previewBackground,
  availableThemes = [],
  onClose,
  onColorChoose,
  onBgChange,
  onReset,
}) => {
  if (!customizeOpen) return null;

  return (
    <div className="customize-wrap" ref={customizeRef}>
      <div className="customize-panel" role="dialog" aria-label="Customize">
        <div className="customize-header">
          <h3>Customize Appearance</h3>
          <button className="customize-close" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div
          className="customize-preview"
          style={{
            backgroundImage: previewBackground,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="preview-tab"></div>
          <div className="preview-bar"></div>
        </div>

        <label className="upload-btn">
          <i className="fa-solid fa-image"></i> Upload a wallpaper
          <input
            type="file"
            accept="image/*"
            onChange={onBgChange}
            style={{ display: "none" }}
          />
        </label>

        <div className="customize-label">
          Color Themes
        </div>
        <div className="swatch-grid">
          {availableThemes.map((t) => {
            const selected = !bgImage && (bgColor === t.id || (!bgColor && t.id.includes("default")));
            return (
              <button
                key={t.id || "default"}
                className={`swatch ${selected ? "selected" : ""}`}
                style={{ backgroundImage: t.gradient }}
                onClick={() => onColorChoose(t.id)}
                title={t.name}
                aria-label={t.name}
              >
                {selected && <i className="fa-solid fa-check"></i>}
              </button>
            );
          })}
        </div>

        {(bgImage || bgColor) && (
          <button className="reset-link" onClick={onReset}>
            <i className="fa-solid fa-rotate-left"></i> Reset to default
          </button>
        )}
      </div>
    </div>
  );
};
