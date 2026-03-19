# Plan: Editable Base Property Cells in BOM Table

## Overview

Allow users to edit base property values directly in BOM table cells. On blur or Enter, the
change is committed to the API via the `setProperties` mutation. Read-only properties
(where `isReadOnly: true`) are not editable.

---

## Mutation Reference

```graphql
mutation SetProperties($input: SetPropertiesInput!) {
  setProperties(input: $input) {
    targetId
    properties {
      name
      displayValue
      value
      definition { id }
    }
  }
}

input SetPropertiesInput {
  targetId: ID!               # Component ID (BomRow.componentId)
  propertyInputs: [PropertyInput!]!
}

input PropertyInput {
  propertyDefinitionId: ID!   # PropertyDefinition.id
  value: PropertyValue        # scalar — String | Int | Float | Boolean
}
```

`SetPropertiesPayload.properties` returns the updated `Property[]`, enabling a targeted
Apollo cache write after a successful mutation.

---

## Key Constraints from Schema

- `targetId` accepts a Component ID (which is what `BomRow.componentId` holds)
- `PropertyValue` is a custom scalar — the actual JS type must match `PropertyDefinition.specification`:
  - `STRING` → `string`
  - `INTEGER` → `number` (integer)
  - `FLOAT`, `DISTANCE`, `DENSITY`, `MASS`, `VOLUME`, `AREA` → `number` (float)
  - `BOOLEAN` → `boolean`
- `PropertyDefinition.isReadOnly: true` → cell must not be editable
- The mutation takes no `state` argument — it targets the component's working/active version

---

## Architecture

### 1. New GraphQL mutation document
**`src/graphql/mutations/baseProperties.ts`**

```ts
export const SET_PROPERTIES = gql`
  mutation SetProperties($input: SetPropertiesInput!) {
    setProperties(input: $input) {
      targetId
      properties {
        name
        displayValue
        value
        definition { id }
      }
    }
  }
`
```

### 2. Value coercion helper
**`src/utils/propertyValue.ts`**

Parse the user's string input into the correct JS type based on `specification`:
- `STRING` → `String(input)`
- `INTEGER` → `parseInt(input, 10)` — reject non-integer
- `FLOAT` / `DISTANCE` / `DENSITY` / `MASS` / `VOLUME` / `AREA` → `parseFloat(input)` — reject NaN
- `BOOLEAN` → accept `"true"` / `"false"` / `"1"` / `"0"` — reject other strings

Returns `{ value: PropertyValue, error: string | null }`.

### 3. Cell editing in `BomBasePropCellInner`

The existing `BomBasePropCellInner` renders a read display value. When the definition is
**not** read-only it becomes an inline-editable cell:

**Read-only mode** (`isReadOnly: true`):
- Shows `displayValue` text as normal
- A small `LockIcon` (fontSize="inherit", `color: 'text.disabled'`) rendered to the right
- Not clickable, no edit mode

**Display mode** (editable, default):
- Shows `displayValue` text as before
- On click → switches to edit mode

**Edit mode:**
- Renders a small MUI `TextField` (size="small", `variant="standard"`) pre-filled with
  the raw `value` (not `displayValue`) so numeric values can be edited without unit suffix
- On `Enter` or `onBlur` → validate input, then commit if valid
- On `Escape` → cancel, revert to display mode

**Saving state** (mutation in-flight, no optimistic update):
- Cell returns to display mode immediately showing the **previous** value
- The cell and its text are greyed out (`color: 'text.disabled'`, `pointerEvents: 'none'`)
- A small `CircularProgress` spinner is shown alongside the value
- The cell cannot be clicked or edited again until the mutation resolves
- On success → Apollo cache updated → cell re-renders with confirmed new value
- On error → saving state clears, cell reverts to original value and shows error

### 4. `BomCellContext` additions

```ts
setBaseProperty: (
  componentId: string,
  definitionId: string,
  specification: string | null,
  rawValue: string
) => Promise<void>
```

The callback lives in `BomTab` (which has access to `useMutation`).

### 5. `BomTab` mutation wiring

`BomTab` calls `useMutation(SET_PROPERTIES)` and provides `setBaseProperty` in `cellContext`.

After a successful mutation the payload's `properties` array is used to write directly into
the Apollo cache for the component's base properties query, replacing the changed entry.
This causes all base property cells for that component to re-render with the confirmed value.

### 6. `makeBasePropertyColumn` — pass full `definition`

`BomBasePropCellInner` needs `specification` (for value coercion) and `isReadOnly` (to
gate editing). Since `def` is already closed over in `makeBasePropertyColumn`, the cell
receives the full `PropertyDefinition` object instead of just `definitionId`.

---

## Data Flow

```
User clicks cell
  → switch to edit mode (TextField, pre-filled with raw value)

User hits Enter or blurs
  → coerceValue(rawInput, specification) → { value, error }
  → if error: show inline validation message, stay in edit mode
  → if ok:
      → switch back to display mode with previous value, greyed out + spinner (saving state)
      → setBaseProperty(componentId, definitionId, coercedValue)
        → useMutation SET_PROPERTIES
        → on success: writeQuery to Apollo cache → cell re-renders with confirmed value, saving state clears
        → on error: saving state clears, cell reverts to original value, MUI Snackbar/Alert toast shown at bottom of screen with error message

User hits Escape
  → cancel edit, revert to display mode, no mutation fired
```

---

## Open Questions

