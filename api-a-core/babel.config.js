export default {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      useBuiltIns: 'usage',
      corejs: 3
    }]
  ],
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    '@babel/plugin-transform-runtime'
  ]
};
