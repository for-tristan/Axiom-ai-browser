import React from 'react';
import type { MouseEvent, DragEvent as ReactDragEvent } from 'react';
import type { Tab } from '../../types/browser';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: number;
  draggedTabId: number | null;
  dragOverTabId: number | null;
  onSelectTab: (id: number) => void;
  onCloseTab: (event: MouseEvent, id: number) => void;
  onAddTab: () => void;
  onTabDragStart: (event: ReactDragEvent<HTMLDivElement>, id: number) => void;
  onTabDrop: (event: ReactDragEvent<HTMLDivElement>, targetId: number) => void;
  setDragOverTabId: (id: number | null) => void;
  setDraggedTabId: (id: number | null) => void;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  draggedTabId,
  dragOverTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  onTabDragStart,
  onTabDrop,
  setDragOverTabId,
  setDraggedTabId,
  setTabs,
}) => {
  return (
    <header className="top-tab-bar">
      <div className={`tabs-container ${tabs.length > 5 ? "compact" : ""}`}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? "active" : ""} ${draggedTabId === tab.id ? "dragging" : ""} ${dragOverTabId === tab.id && draggedTabId !== tab.id ? "drag-over" : ""}`}
            onClick={() => onSelectTab(tab.id)}
            draggable
            onDragStart={(event) => onTabDragStart(event, tab.id)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverTabId(tab.id);
            }}
            onDrop={(event) => onTabDrop(event, tab.id)}
            onDragEnd={() => {
              setDraggedTabId(null);
              setDragOverTabId(null);
            }}
            onMouseDown={(event) => {
              if (event.button === 1) event.preventDefault();
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onCloseTab(event as unknown as MouseEvent, tab.id);
              }
            }}
            role="tab"
            aria-selected={tab.id === activeTabId}
            tabIndex={0}
          >
            {tab.loading ? (
              <span className="tab-spinner" aria-hidden="true"></span>
            ) : tab.favicon ? (
              <img
                className="tab-favicon"
                src={tab.favicon}
                alt=""
                onError={() =>
                  setTabs((currentTabs) =>
                    currentTabs.map((currentTab) =>
                      currentTab.id === tab.id
                        ? { ...currentTab, favicon: undefined }
                        : currentTab,
                    ),
                  )
                }
              />
            ) : (
              <i className="fa-solid fa-globe tab-icon"></i>
            )}
            <span className="tab-title">{tab.title}</span>
            <button
              className="close-tab-btn"
              onClick={(e) => onCloseTab(e, tab.id)}
              title="Close Tab"
              aria-label={`Close ${tab.title}`}
              disabled={tabs.length === 1}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
        <button
          className="add-tab-btn"
          onClick={onAddTab}
          title="New Tab"
          aria-label="New tab"
        >
          <i className="fa-solid fa-plus"></i>
        </button>
      </div>
    </header>
  );
};
