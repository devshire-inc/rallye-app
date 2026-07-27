import { Checkbox } from './Checkbox/Checkbox'
import { Input } from './Input/Input'
import { Segmented } from './Segmented/Segmented'
import { Select } from './Select/Select'
import { Switch } from './Switch/Switch'

export const validInputWithLabel = <Input label="E-mail" />
export const validInputWithAriaLabel = <Input ariaLabel="Buscar" />
export const validSelectWithLabel = <Select label="Esporte" options={['Padel']} />
export const validSelectWithAriaLabel = <Select ariaLabel="Esporte" options={['Padel']} />
export const validCheckboxWithLabel = <Checkbox label="Aceito os termos" />
export const validCheckboxWithAriaLabel = <Checkbox ariaLabel="Marcar todos" />
export const validSwitchWithLabel = <Switch label="Notificações" />
export const validSwitchWithAriaLabel = <Switch ariaLabel="Modo escuro" />
export const validSegmentedUsage = <Segmented options={['Dia', 'Semana']} ariaLabel="Período" />

// @ts-expect-error — Input exige label ou ariaLabel via AccessibleLabel
export const invalidInputNoLabel = <Input />
// @ts-expect-error — Select exige label ou ariaLabel via AccessibleLabel
export const invalidSelectNoLabel = <Select options={['Padel']} />
// @ts-expect-error — Checkbox exige label ou ariaLabel via AccessibleLabel
export const invalidCheckboxNoLabel = <Checkbox />
// @ts-expect-error — Switch exige label ou ariaLabel via AccessibleLabel
export const invalidSwitchNoLabel = <Switch />
// @ts-expect-error — Segmented exige ariaLabel (prop obrigatória)
export const invalidSegmentedNoAriaLabel = <Segmented options={['Dia', 'Semana']} />
