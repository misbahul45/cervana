export default defineAppConfig({
  ui: {
    colors: {
      primary: 'reef',
      secondary: 'tide',
      neutral: 'shell',
      success: 'emerald',
      warning: 'amber',
      error: 'red',
      info: 'sky',
    },
    button: {
      slots: {
        base: 'rc-ui-btn',
      },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'rc-ui-btn--solid' },
        { color: 'secondary', variant: 'solid', class: 'rc-ui-btn--secondary' },
        { variant: 'outline', class: 'rc-ui-btn--quiet' },
        { variant: 'soft', class: 'rc-ui-btn--quiet' },
        { variant: 'subtle', class: 'rc-ui-btn--quiet' },
        { variant: 'ghost', class: 'rc-ui-btn--flat' },
        { variant: 'link', class: 'rc-ui-btn--flat' },
      ],
    },
  },
});
