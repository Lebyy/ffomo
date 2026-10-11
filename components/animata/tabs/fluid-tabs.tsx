// Animata fluid tabs (MIT): https://animata.design/docs/tabs/fluid-tabs
"use client";

import { motion } from "motion/react";
import {
  Children,
  type ComponentProps,
  createContext,
  type FocusEvent,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  use,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  handleTabListFocusCapture,
  handleTabListKeyDown,
  tabFocusClass,
  useTabSelection,
} from "./shared";

const INDICATOR_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 0.75,
};

const LABEL_TRANSITION = {
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1] as const,
};

function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return still;
}

type FluidTabsContextValue = {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  indicatorLayoutId: string;
  still: boolean;
};

const FluidTabsContext = createContext<FluidTabsContextValue | null>(null);

type FluidTabSlotContextValue = {
  index: number;
};

const FluidTabSlotContext = createContext<FluidTabSlotContextValue | null>(null);

function useFluidTabs() {
  const context = use(FluidTabsContext);
  if (!context) {
    throw new Error("FluidTabs primitives must be used within <FluidTabs>.");
  }
  return context;
}

function FluidTabSlot({ index, children }: { index: number; children: ReactNode }) {
  const value = useMemo(() => ({ index }), [index]);
  return <FluidTabSlotContext value={value}>{children}</FluidTabSlotContext>;
}

function useFluidTabSlot() {
  const context = use(FluidTabSlotContext);
  if (!context) {
    throw new Error("FluidTabs.Tab must be a direct child of <FluidTabs.List>.");
  }
  return context;
}

type FluidTabsRootProps = {
  children: ReactNode;
  defaultActiveIndex?: number;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  className?: string;
};

function FluidTabsRoot({
  children,
  defaultActiveIndex = 0,
  activeIndex: activeIndexProp,
  onActiveIndexChange,
  className,
}: FluidTabsRootProps) {
  const { activeIndex, setActiveIndex, focusedIndex, setFocusedIndex } = useTabSelection({
    defaultActiveIndex,
    activeIndex: activeIndexProp,
    onActiveIndexChange,
  });
  const still = useStill();
  const indicatorLayoutId = `fluid-tab-indicator-${useId().replace(/:/g, "")}`;

  const rootContext = useMemo(
    () => ({
      activeIndex,
      setActiveIndex,
      focusedIndex,
      setFocusedIndex,
      indicatorLayoutId,
      still,
    }),
    [activeIndex, setActiveIndex, focusedIndex, setFocusedIndex, indicatorLayoutId, still],
  );

  return (
    <FluidTabsContext value={rootContext}>
      <div className={cn("flex w-full max-w-md items-center justify-center", className)}>
        {children}
      </div>
    </FluidTabsContext>
  );
}

type FluidTabsListProps = ComponentProps<"nav"> & {
  "aria-label"?: string;
};

function FluidTabsList({
  className,
  children,
  "aria-label": ariaLabel = "Tabs",
  onKeyDown,
  onFocusCapture,
  ...props
}: FluidTabsListProps) {
  const { activeIndex, setActiveIndex, setFocusedIndex } = useFluidTabs();
  const tabs = Children.toArray(children).filter(isValidElement);
  const count = tabs.length;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("relative overflow-visible rounded-full bg-muted p-1 shadow-sm", className)}
      {...props}
    >
      <div
        role="tablist"
        tabIndex={0}
        onFocusCapture={(event: FocusEvent<HTMLElement>) => {
          onFocusCapture?.(event);
          handleTabListFocusCapture(event, activeIndex, setFocusedIndex);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) {
            handleTabListKeyDown(event, count, setActiveIndex, setFocusedIndex);
          }
        }}
        className="flex w-full gap-1"
      >
        {tabs.map((tab, index) => (
          <FluidTabSlot key={tab.key ?? index} index={index}>
            {tab}
          </FluidTabSlot>
        ))}
      </div>
    </nav>
  );
}

function FluidTabsIcon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 empty:hidden [&_svg]:size-[18px]", className)}
      {...props}
    />
  );
}

function FluidTabsLabel({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("whitespace-nowrap", className)} {...props} />;
}

type FluidTabsTabProps = ComponentProps<"button"> & {
  label?: string;
};

function FluidTabsTab({
  className,
  children,
  label,
  onClick,
  onFocus,
  ...props
}: FluidTabsTabProps) {
  const { activeIndex, setActiveIndex, setFocusedIndex, indicatorLayoutId, still } = useFluidTabs();
  const { index } = useFluidTabSlot();
  const isSelected = activeIndex === index;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      {...(label ? { "aria-label": label } : {})}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setActiveIndex(index);
        }
      }}
      onFocus={(event: FocusEvent<HTMLButtonElement>) => {
        onFocus?.(event);
        if (!event.defaultPrevented) {
          setFocusedIndex(index);
        }
      }}
      className={cn(
        tabFocusClass("rounded-full"),
        "relative z-10 flex flex-1 items-center justify-center px-4 py-2.5 text-sm font-semibold",
        "motion-reduce:transition-none",
        isSelected ? "text-primary-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {isSelected ? (
        <motion.span
          layoutId={indicatorLayoutId}
          className="absolute inset-0 block rounded-xl bg-primary"
          transition={still ? { duration: 0 } : INDICATOR_SPRING}
          aria-hidden
        />
      ) : null}
      <motion.span
        className="relative z-10 inline-flex items-center justify-center gap-2"
        animate={{ scale: isSelected ? 1 : 0.98 }}
        transition={still ? { duration: 0 } : LABEL_TRANSITION}
      >
        {children}
      </motion.span>
    </button>
  );
}

const FluidTabs = Object.assign(FluidTabsRoot, {
  List: FluidTabsList,
  Tab: FluidTabsTab,
  Icon: FluidTabsIcon,
  Label: FluidTabsLabel,
});

export default FluidTabs;
export { FluidTabsIcon, FluidTabsLabel, FluidTabsList, FluidTabsRoot, FluidTabsTab, useFluidTabs };
