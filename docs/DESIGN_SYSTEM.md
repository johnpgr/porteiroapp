# Design System & Style Guidelines

This document outlines the design system and style conventions used throughout the Expo mobile app. Follow these guidelines to maintain visual consistency across all screens and components.

## Table of Contents

1. [Icon System](#icon-system)
2. [Typography](#typography)
3. [Card Components](#card-components)
4. [Layout Patterns](#layout-patterns)
5. [Color System](#color-system)
6. [Spacing & Sizing](#spacing--sizing)

---

## Icon System

### IconSymbol Component

**Always use `IconSymbol` instead of emojis** for cross-platform consistency. The component uses native SF Symbols on iOS and Material Icons on Android/web.

#### Import
```typescript
import { IconSymbol } from '~/components/ui/IconSymbol';
```

#### Usage Pattern
```typescript
<IconSymbol name="icon.name" color="#333" size={18} />
```

#### Common Icon Mappings

| Emoji (Don't Use) | IconSymbol Name | Material Icon | Context |
|-------------------|-----------------|---------------|---------|
| 👤 | `person.fill` | person | Person/user |
| 👥 | `person.2.fill` | people | Multiple people/family |
| 🏠 | `house.fill` | home | Home/owner |
| 🚗 | `car.fill` | directions-car | Vehicle |
| 📋 | `list.bullet.rectangle` | assignment | List/records |
| 📧 | `envelope.fill` | mail | Email |
| 📱 | `phone.fill` | phone | Phone |
| 🏢 | `building.2.fill` | business | Building |
| ⏰ | `clock.fill` | schedule | Time/schedule |
| ✅ | `checkmark.circle.fill` | check-circle | Success/approved |
| ❌ | `exclamationmark.circle.fill` | error | Error/denied |
| ⏳ | `hourglass` | hourglass-empty | Pending/waiting |
| 🔔 | `bell.fill` | notifications | Notifications |
| ✏️ | `pencil` | edit | Edit |
| 🗑️ | `trash.fill` | delete | Delete |
| ⭐ | `star.fill` | star | Favorite/frequent |
| 🏷️ | `tag.fill` | local-offer | Tag/label |
| 🎨 | `paintpalette.fill` | palette | Color |
| 📦 | `shippingbox.fill` | inventory | Package/delivery |
| ℹ️ | `info.circle.fill` | info | Information |
| 👷 | `person.badge.key.fill` | work | Worker/employee |

#### Icon Sizing Guidelines

- **Section headers**: `size={18}`
- **Button icons**: `size={18}` or `size={20}`
- **Card content**: `size={14}` or `size={16}`
- **Inline text**: `size={12}` or `size={14}`
- **Badges**: `size={12}` or `size={14}`

#### Icon + Text Pattern

When displaying icons with text, use a flex container:

```typescript
<View style={styles.iconTextContainer}>
  <IconSymbol name="envelope.fill" color="#666" size={14} />
  <Text style={styles.text}>Email text</Text>
</View>
```

```typescript
iconTextContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 4,
}
```

---

## Typography

### Font Size Rules

**All font sizes must be even numbers** (12, 14, 16, 18, etc.)

#### Size Hierarchy

| Element | Font Size | Weight | Use Case |
|---------|-----------|--------|----------|
| Section Title | `16` | `bold` | Main section headers |
| Card Title | `14` | `bold` | Card/item titles |
| Body Text | `12` | `normal` | Regular content, details |
| Button Text | `12` or `14` | `bold` | Button labels |
| Secondary Info | `12` | `normal` or `500` | Metadata, labels |
| Empty State | `14` | `bold` | Empty state messages |
| Loading/Error | `14` | `normal` | Status messages |

#### Example Styles

```typescript
sectionTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#333',
}

cardTitle: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 4,
}

bodyText: {
  fontSize: 12,
  color: '#666',
  marginBottom: 4,
}
```

---

## Card Components

### Card Styling Rules

**Cards must NOT have shadows or elevation** for a flat, modern design.

#### ❌ Don't Use
```typescript
card: {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3.84,
  elevation: 5,
}
```

#### ✅ Use Instead
```typescript
card: {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
}
```

#### Standard Card Structure

```typescript
<View style={styles.card}>
  <Text style={styles.cardTitle}>Title</Text>
  <View style={styles.infoRowContainer}>
    <IconSymbol name="icon.name" color="#666" size={14} />
    <Text style={styles.cardText}>Content</Text>
  </View>
</View>
```

---

## Layout Patterns

### Section Headers

Always use icon + text pattern for section headers:

```typescript
<View style={styles.sectionTitleContainer}>
  <IconSymbol name="list.bullet.rectangle" color="#333" size={18} />
  <Text style={styles.sectionTitle}>Section Title</Text>
</View>
```

```typescript
sectionTitleContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
}
```

### Info Rows

For displaying information with icons:

```typescript
<View style={styles.infoRowContainer}>
  <IconSymbol name="envelope.fill" color="#666" size={14} />
  <Text style={styles.infoText}>email@example.com</Text>
</View>
```

```typescript
infoRowContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 4,
}
```

### Action Buttons

Buttons with icons should display icon + text:

```typescript
<TouchableOpacity style={styles.actionButton}>
  <IconSymbol name="pencil" color="#333" size={14} />
  <Text style={styles.actionButtonText}>Editar</Text>
</TouchableOpacity>
```

```typescript
actionButton: {
  backgroundColor: '#f0f8ff',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 6,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}
```

---

## Color System

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Green | `#4CAF50` | Primary actions, success states |
| Primary Blue | `#2196F3` | Secondary actions, info |
| Error Red | `#f44336` | Errors, destructive actions |
| Warning Orange | `#FF9800` | Warnings, pending states |

### Text Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Text | `#333` | Main text, titles |
| Secondary Text | `#666` | Body text, descriptions |
| Tertiary Text | `#999` | Muted text, hints |
| Error Text | `#d32f2f` | Error messages |
| Success Text | `#2d5a2d` | Success states |

### Background Colors

| Color | Hex | Usage |
|-------|-----|-------|
| White | `#fff` | Card backgrounds |
| Light Gray | `#f5f5f5` | Screen backgrounds |
| Light Blue | `#f0f8ff` | Info containers |
| Light Green | `#e8f5e8` | Success badges |
| Light Red | `#ffebee` | Error containers |

---

## Spacing & Sizing

### Standard Spacing

- **Section padding**: `20`
- **Card padding**: `16`
- **Card margin bottom**: `12`
- **Element gap**: `6` or `8`
- **Icon-text gap**: `6` or `8`

### Border Radius

- **Cards**: `12`
- **Buttons**: `8` or `12`
- **Badges**: `12` or `20` (for pills)

### Standard Sizes

- **Icon sizes**: `12`, `14`, `16`, `18`, `20`, `24`
- **Button height**: `42` (circular buttons) or `auto` with padding
- **Card padding**: `16`

---

## Component Patterns

### Status Badges

```typescript
<View style={styles.statusBadge}>
  <IconSymbol name="checkmark.circle.fill" color="#2d5a2d" size={14} />
  <Text style={styles.statusText}>Aprovado</Text>
</View>
```

```typescript
statusBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#e8f5e8',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  gap: 4,
}
```

### Empty States

```typescript
<View style={styles.emptyContainer}>
  <IconSymbol name="envelope" color="#666" size={24} />
  <Text style={styles.emptyText}>Nenhum item encontrado</Text>
</View>
```

```typescript
emptyContainer: {
  padding: 20,
  backgroundColor: '#f8f9fa',
  borderRadius: 10,
  alignItems: 'center',
  marginBottom: 10,
  gap: 8,
}
```

### Error States

```typescript
<View style={styles.errorContainer}>
  <View style={styles.errorTextContainer}>
    <IconSymbol name="exclamationmark.circle.fill" color="#d32f2f" size={16} />
    <Text style={styles.errorText}>Error message</Text>
  </View>
</View>
```

```typescript
errorTextContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
}
```

---

## Checklist for New Components

When creating or modifying components, ensure:

- [ ] All emojis replaced with `IconSymbol` components
- [ ] All font sizes are even numbers (12, 14, 16, 18)
- [ ] Cards have no shadows or elevation
- [ ] Icons are properly sized for their context
- [ ] Icon + text containers use flexbox with proper gap spacing
- [ ] Colors follow the color system
- [ ] Spacing follows standard patterns
- [ ] Section headers use icon + text pattern

---

## Examples

### Complete Card Example

```typescript
<View style={styles.card}>
  <Text style={styles.cardTitle}>Visitor Name</Text>
  
  <View style={styles.infoRowContainer}>
    <IconSymbol name="doc.text" color="#666" size={14} />
    <Text style={styles.cardText}>Document number</Text>
  </View>
  
  <View style={styles.infoRowContainer}>
    <IconSymbol name="phone.fill" color="#666" size={14} />
    <Text style={styles.cardText}>Phone number</Text>
  </View>
  
  <View style={styles.statusBadge}>
    <IconSymbol name="checkmark.circle.fill" color="#2d5a2d" size={14} />
    <Text style={styles.statusText}>Aprovado</Text>
  </View>
</View>
```

### Complete Section Example

```typescript
<View style={styles.section}>
  <View style={styles.sectionTitleContainer}>
    <IconSymbol name="list.bullet.rectangle" color="#333" size={18} />
    <Text style={styles.sectionTitle}>Section Title</Text>
  </View>
  
  <Text style={styles.sectionDescription}>
    Section description text
  </Text>
  
  {/* Content */}
</View>
```

---

## Migration Guide

When refactoring existing components:

1. **Remove emojis**: Replace all emojis with appropriate `IconSymbol` components
2. **Remove shadows**: Remove all `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, and `elevation` properties
3. **Normalize font sizes**: Ensure all font sizes are even numbers
4. **Add icon containers**: Wrap icon + text combinations in flex containers with proper gap spacing
5. **Update section headers**: Use icon + text pattern for all section titles

---

## Notes

- Icon sizes should be proportional to text sizes (icon slightly smaller or same size)
- Always use semantic color names (e.g., `#4CAF50` for success) rather than arbitrary colors
- Maintain consistent spacing between related elements
- Use `gap` property in flex containers for consistent spacing
- Icons should match the semantic meaning of the text they accompany

