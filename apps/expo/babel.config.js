module.exports = function (api) {
  api.cache(true);
  let plugins = [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '~': '.',
        },
      },
    ],
  ];

  return {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],

    plugins,
  };
};
