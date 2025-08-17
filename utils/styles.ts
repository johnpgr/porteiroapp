import { StyleSheet } from 'react-native';

/**
 * Flattens an array of styles into a single style object.
 * This prevents the "Failed to set an indexed property on 'CSSStyleDeclaration'" error
 * that occurs in React 19 when style arrays are passed to DOM elements.
 *
 * @param styles - Array of style objects or a single style object
 * @returns Flattened style object
 */
export function flattenStyles(styles: any): any {
  if (Array.isArray(styles)) {
    return StyleSheet.flatten(styles);
  }
  return styles;
}
