export const preventDefaultStopPropagation = (ev: Event) => {
  ev.preventDefault();
  ev.stopPropagation();
};
