declare module '@event-calendar/core' {
  export default class EventCalendar {
    constructor(config: {
      props: {
        options: Record<string, unknown>;
        plugins: unknown[];
      };
      target: HTMLElement;
    });

    destroy(): void;
    getOption(name: string): unknown;
    next(): void;
    prev(): void;
    setOption(name: string, value: unknown): void;
  }
}

declare module '@event-calendar/interaction' {
  const Interaction: unknown;
  export default Interaction;
}

declare module '@event-calendar/resource-timeline' {
  const ResourceTimeline: unknown;
  export default ResourceTimeline;
}
