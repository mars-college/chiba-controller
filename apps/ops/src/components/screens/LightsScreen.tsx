import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  ColorPicker,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import {
  IconBulb,
  IconDeviceFloppy,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  applyPreset,
  controlAllLights,
  controlLight,
  createLight,
  createPreset,
  deleteLight,
  deletePreset,
  discoverLights,
  fetchLights,
  fetchPresets,
  importLights,
  type LightControlRequest,
  type LightImportInput,
  type LightPreset,
  type LightRecord,
  type LightUpsertInput,
  type PresetLightSetting,
  updateLight,
  updatePreset,
} from '../../lib/deviceApi'
import { OpsFormDock, OpsPageHeader, OpsToolbar } from '../ui/OpsSurface'

type ControlMode = 'color' | 'temperature'

type LightForm = {
  id: string
  name: string
  ipAddress: string
  port: string
  deviceId: string
  sku: string
  deviceType: string
}

type PresetSettingDraft = {
  key: string
  lightId: string
  power: boolean
  mode: ControlMode
  hue: number
  saturation: number
  brightness: number
  kelvin: number
}

type PresetDraft = {
  id: string | null
  name: string
  isPredefined: boolean
  settings: PresetSettingDraft[]
}

function toReadableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function rgbToHex(args: { r: number; g: number; b: number }): string {
  const toPart = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  return `#${toPart(args.r)}${toPart(args.g)}${toPart(args.b)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function hsbToRgb(args: { hue: number; saturation: number; brightness: number }): {
  r: number
  g: number
  b: number
} {
  const h = ((args.hue % 360) + 360) % 360
  const s = clamp(args.saturation, 0, 100) / 100
  const v = clamp(args.brightness, 0, 100) / 100

  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let rPrime = 0
  let gPrime = 0
  let bPrime = 0

  if (h < 60) {
    rPrime = c
    gPrime = x
  } else if (h < 120) {
    rPrime = x
    gPrime = c
  } else if (h < 180) {
    gPrime = c
    bPrime = x
  } else if (h < 240) {
    gPrime = x
    bPrime = c
  } else if (h < 300) {
    rPrime = x
    bPrime = c
  } else {
    rPrime = c
    bPrime = x
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  }
}

function rgbToHsb(args: { r: number; g: number; b: number }): {
  hue: number
  saturation: number
  brightness: number
} {
  const r = clamp(args.r, 0, 255) / 255
  const g = clamp(args.g, 0, 255) / 255
  const b = clamp(args.b, 0, 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let hue = 0
  if (delta !== 0) {
    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2)
    } else {
      hue = 60 * ((r - g) / delta + 4)
    }
  }

  if (hue < 0) hue += 360

  return {
    hue: Math.round(hue),
    saturation: max === 0 ? 0 : Math.round((delta / max) * 100),
    brightness: Math.round(max * 100),
  }
}

function kelvinToRgbCss(kelvin: number, brightness: number): string {
  const temp = clamp(kelvin, 1000, 40000) / 100
  let r = 255
  let g = 255
  let b = 255

  if (temp <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(temp) - 161.1195681661
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492)
    b = 255
  }

  const scale = clamp(brightness, 0, 100) / 100
  const channel = (value: number) => clamp(Math.round(value * scale), 0, 255)
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`
}

function previewColor(args: {
  power: boolean
  mode: ControlMode
  hue: number
  saturation: number
  brightness: number
  kelvin: number
}): string {
  if (!args.power) return 'rgba(255, 255, 255, 0.08)'
  if (args.mode === 'temperature') {
    return kelvinToRgbCss(args.kelvin, args.brightness)
  }
  const rgb = hsbToRgb({
    hue: args.hue,
    saturation: args.saturation,
    brightness: args.brightness,
  })
  return rgbToHex(rgb)
}

function colorHexFromControls(args: {
  hue: number
  saturation: number
  brightness: number
}): string {
  return rgbToHex(
    hsbToRgb({
      hue: args.hue,
      saturation: args.saturation,
      brightness: args.brightness,
    })
  )
}

function requestFromControls(args: {
  power: boolean
  mode: ControlMode
  hue: number
  saturation: number
  brightness: number
  kelvin: number
}): LightControlRequest {
  if (!args.power) return { power: false }
  if (args.mode === 'temperature') {
    return {
      power: true,
      kelvin: Math.round(args.kelvin),
      brightness: Math.round(args.brightness),
    }
  }
  return {
    power: true,
    hue: Math.round(args.hue),
    saturation: Math.round(args.saturation),
    brightness: Math.round(args.brightness),
  }
}

function controlModeFromSetting(setting: PresetLightSetting): ControlMode {
  return typeof setting.kelvin === 'number' ? 'temperature' : 'color'
}

function emptyLightForm(): LightForm {
  return {
    id: '',
    name: '',
    ipAddress: '',
    port: '4003',
    deviceId: '',
    sku: '',
    deviceType: '',
  }
}

function lightFormFromRecord(light: LightRecord): LightForm {
  return {
    id: light.id,
    name: light.name,
    ipAddress: light.ipAddress,
    port: String(light.port),
    deviceId: light.deviceId ?? '',
    sku: light.sku ?? '',
    deviceType: light.deviceType ?? '',
  }
}

function createDraftSetting(lightId = '*'): PresetSettingDraft {
  return {
    key: `${lightId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    lightId,
    power: true,
    mode: 'temperature',
    hue: 30,
    saturation: 100,
    brightness: 30,
    kelvin: 2700,
  }
}

function presetDraftFromPreset(preset: LightPreset): PresetDraft {
  return {
    id: preset.id,
    name: preset.name,
    isPredefined: preset.isPredefined,
    settings: preset.settings.map((setting, index) => ({
      key: `${preset.id}-${index}-${setting.lightId}`,
      lightId: setting.lightId,
      power: setting.power ?? true,
      mode: controlModeFromSetting(setting),
      hue: setting.hue ?? 0,
      saturation: setting.saturation ?? 100,
      brightness: setting.brightness ?? 100,
      kelvin: setting.kelvin ?? 4000,
    })),
  }
}

function emptyPresetDraft(): PresetDraft {
  return {
    id: null,
    name: '',
    isPredefined: false,
    settings: [createDraftSetting('*')],
  }
}

function presetSettingFromDraft(setting: PresetSettingDraft): PresetLightSetting {
  return requestFromControls({
    power: setting.power,
    mode: setting.mode,
    hue: setting.hue,
    saturation: setting.saturation,
    brightness: setting.brightness,
    kelvin: setting.kelvin,
  }).power === false
    ? { lightId: setting.lightId, power: false }
    : {
        lightId: setting.lightId,
        ...requestFromControls({
          power: setting.power,
          mode: setting.mode,
          hue: setting.hue,
          saturation: setting.saturation,
          brightness: setting.brightness,
          kelvin: setting.kelvin,
        }),
      }
}

function settingsSummary(preset: LightPreset, lightById: Map<string, LightRecord>): string {
  if (preset.settings.length === 0) return 'No settings'
  const labels = preset.settings.map((setting) => {
    if (setting.lightId === '*') return 'All lights'
    return lightById.get(setting.lightId)?.name ?? setting.lightId
  })
  if (labels.length <= 2) return labels.join(', ')
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`
}

function targetLabel(lightId: string, lightById: Map<string, LightRecord>): string {
  if (lightId === '*') return 'All lights'
  return lightById.get(lightId)?.name ?? lightId
}

function LightControlCard(props: {
  light: LightRecord
  onControl: (lightId: string, request: LightControlRequest) => Promise<void>
  onEdit: (light: LightRecord) => void
  onDelete: (light: LightRecord) => Promise<void>
}) {
  const { light } = props
  const [busy, setBusy] = useState(false)
  const [power, setPower] = useState(light.state?.power ?? false)
  const [mode, setMode] = useState<ControlMode>(light.state?.kelvin ? 'temperature' : 'color')
  const [hue, setHue] = useState(light.state?.hue ?? 0)
  const [saturation, setSaturation] = useState(light.state?.saturation ?? 100)
  const [brightness, setBrightness] = useState(light.state?.brightness ?? 100)
  const [kelvin, setKelvin] = useState(light.state?.kelvin ?? 4000)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setPower(light.state?.power ?? false)
    setMode(light.state?.kelvin ? 'temperature' : 'color')
    setHue(light.state?.hue ?? 0)
    setSaturation(light.state?.saturation ?? 100)
    setBrightness(light.state?.brightness ?? 100)
    setKelvin(light.state?.kelvin ?? 4000)
  }, [light])

  const preview = previewColor({
    power,
    mode,
    hue,
    saturation,
    brightness,
    kelvin,
  })

  const handleColorChange = (value: string) => {
    const rgb = hexToRgb(value)
    if (!rgb) return
    const next = rgbToHsb(rgb)
    setHue(next.hue)
    setSaturation(next.saturation)
    setBrightness(next.brightness)
  }

  const togglePower = async () => {
    const next = !power
    setPower(next)
    setBusy(true)
    try {
      await props.onControl(light.id, { power: next })
    } catch (error) {
      setPower(!next)
      notifications.show({
        color: 'red',
        title: `Failed to toggle ${light.name}`,
        message: toReadableError(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    setBusy(true)
    try {
      await props.onControl(
        light.id,
        requestFromControls({
          power,
          mode,
          hue,
          saturation,
          brightness,
          kelvin,
        })
      )
      notifications.show({
        color: 'green',
        title: light.name,
        message: 'Light updated',
      })
    } catch (error) {
      notifications.show({
        color: 'red',
        title: `Failed to update ${light.name}`,
        message: toReadableError(error),
      })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(`Delete light "${light.name}"?`)
    if (!confirmed) return
    setDeleting(true)
    try {
      await props.onDelete(light)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card withBorder radius='md' p='md'>
      <Stack gap='sm'>
        <Group justify='space-between' align='flex-start'>
          <Stack gap={2}>
            <Group gap='xs'>
              <Text fw={700}>{light.name}</Text>
              <Badge variant='light' size='xs'>
                {light.id}
              </Badge>
              {light.sku ? (
                <Badge variant='light' size='xs' color='gray'>
                  {light.sku}
                </Badge>
              ) : null}
            </Group>
            <Text size='xs' c='dimmed'>
              {light.ipAddress}:{light.port}
            </Text>
            {light.deviceId ? (
              <Text size='xs' c='dimmed'>
                device {light.deviceId}
              </Text>
            ) : null}
          </Stack>
          <Stack gap='xs' align='flex-end'>
            <Badge color={light.reachable ? 'green' : 'gray'} variant='light'>
              {light.reachable ? 'Reachable' : 'Offline'}
            </Badge>
            <Group gap={4}>
              <ActionIcon
                variant='light'
                color='blue'
                onClick={() => props.onEdit(light)}
                aria-label={`Edit ${light.name}`}
              >
                <IconEdit size={14} />
              </ActionIcon>
              <ActionIcon
                variant='light'
                color='red'
                onClick={() => void handleDelete()}
                loading={deleting}
                aria-label={`Delete ${light.name}`}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          </Stack>
        </Group>

        <Paper
          withBorder
          radius='sm'
          p='xs'
          style={{
            background: preview,
            minHeight: 44,
            opacity: power ? 1 : 0.45,
          }}
        />

        <Group justify='space-between'>
          <Text size='sm'>Power</Text>
          <Switch checked={power} onChange={() => void togglePower()} disabled={busy || deleting} />
        </Group>

        <SegmentedControl
          value={mode}
          onChange={(value) => setMode((value as ControlMode) || 'color')}
          data={[
            { label: 'Color', value: 'color' },
            { label: 'Temp', value: 'temperature' },
          ]}
          fullWidth
          size='xs'
          disabled={!power || busy || deleting}
        />

        {mode === 'temperature' ? (
          <Stack gap={6}>
            <Group justify='space-between'>
              <Text size='xs' c='dimmed'>
                Temperature
              </Text>
              <Text size='xs' c='dimmed'>
                {Math.round(kelvin)}K
              </Text>
            </Group>
            <Slider
              min={2000}
              max={9000}
              step={50}
              value={kelvin}
              onChange={setKelvin}
              disabled={!power || busy || deleting}
            />
          </Stack>
        ) : (
          <Stack gap={6}>
            <Text size='xs' c='dimmed'>
              Color
            </Text>
            <ColorPicker
              format='hex'
              value={colorHexFromControls({ hue, saturation, brightness })}
              onChange={handleColorChange}
              fullWidth
            />
            <Group justify='space-between'>
              <Text size='xs' c='dimmed'>
                Hue {Math.round(hue)}°
              </Text>
              <Text size='xs' c='dimmed'>
                Sat {Math.round(saturation)}%
              </Text>
            </Group>
          </Stack>
        )}

        <Stack gap={6}>
          <Group justify='space-between'>
            <Text size='xs' c='dimmed'>
              Brightness
            </Text>
            <Text size='xs' c='dimmed'>
              {Math.round(brightness)}%
            </Text>
          </Group>
          <Slider
            min={0}
            max={100}
            step={1}
            value={brightness}
            onChange={setBrightness}
            disabled={!power || busy || deleting}
          />
        </Stack>

        <Button
          leftSection={<IconDeviceFloppy size={14} />}
          onClick={() => void apply()}
          loading={busy}
          variant='light'
          disabled={deleting}
        >
          Apply
        </Button>
      </Stack>
    </Card>
  )
}

function PresetSettingCard(props: {
  index: number
  setting: PresetSettingDraft
  lightOptions: Array<{ value: string; label: string }>
  lightById: Map<string, LightRecord>
  disabled: boolean
  onChange: (next: PresetSettingDraft) => void
  onRemove: () => void
}) {
  const { setting } = props
  const preview = previewColor({
    power: setting.power,
    mode: setting.mode,
    hue: setting.hue,
    saturation: setting.saturation,
    brightness: setting.brightness,
    kelvin: setting.kelvin,
  })

  const handleColorChange = (value: string) => {
    const rgb = hexToRgb(value)
    if (!rgb) return
    const next = rgbToHsb(rgb)
    props.onChange({
      ...setting,
      hue: next.hue,
      saturation: next.saturation,
      brightness: next.brightness,
    })
  }

  return (
    <Card withBorder radius='md' p='md'>
      <Stack gap='md'>
        <Group justify='space-between' align='flex-start'>
          <Stack gap={2}>
            <Group gap='xs'>
              <Badge variant='light'>Rule {String(props.index + 1).padStart(2, '0')}</Badge>
              <Text fw={700}>{targetLabel(setting.lightId, props.lightById)}</Text>
            </Group>
            <Text size='xs' c='dimmed'>
              Define the exact state this preset should push to the selected light target.
            </Text>
          </Stack>
          <ActionIcon
            variant='light'
            color='red'
            onClick={props.onRemove}
            aria-label='Remove preset setting'
            disabled={props.disabled}
          >
            <IconX size={14} />
          </ActionIcon>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
          <Stack gap='sm'>
            <Select
              label='Target'
              data={props.lightOptions}
              value={setting.lightId}
              onChange={(value) => props.onChange({ ...setting, lightId: value ?? '*' })}
              disabled={props.disabled}
              searchable
            />

            <Group justify='space-between'>
              <Text size='sm'>Power on</Text>
              <Switch
                checked={setting.power}
                onChange={(event) =>
                  props.onChange({
                    ...setting,
                    power: event.currentTarget.checked,
                  })
                }
                disabled={props.disabled}
              />
            </Group>

            <SegmentedControl
              value={setting.mode}
              onChange={(value) =>
                props.onChange({
                  ...setting,
                  mode: (value as ControlMode) || 'color',
                })
              }
              data={[
                { label: 'Color', value: 'color' },
                { label: 'Temp', value: 'temperature' },
              ]}
              fullWidth
              disabled={!setting.power || props.disabled}
            />
          </Stack>

          <Paper
            withBorder
            radius='md'
            p='md'
            style={{
              background: preview,
              minHeight: 120,
              opacity: setting.power ? 1 : 0.45,
            }}
          >
            <Stack gap={4} justify='space-between' style={{ minHeight: '100%' }}>
              <Text size='xs' fw={700} c={setting.power ? 'white' : 'dimmed'}>
                Live Preview
              </Text>
              <Text size='sm' c={setting.power ? 'white' : 'dimmed'}>
                {setting.power
                  ? setting.mode === 'temperature'
                    ? `${Math.round(setting.kelvin)}K at ${Math.round(setting.brightness)}%`
                    : `Hue ${Math.round(setting.hue)}°, Sat ${Math.round(
                        setting.saturation
                      )}%, Brightness ${Math.round(setting.brightness)}%`
                  : 'Power off'}
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>

        {setting.mode === 'temperature' ? (
          <Stack gap={6}>
            <Group justify='space-between'>
              <Text size='xs' c='dimmed'>
                Temperature
              </Text>
              <Text size='xs' c='dimmed'>
                {Math.round(setting.kelvin)}K
              </Text>
            </Group>
            <Slider
              min={2000}
              max={9000}
              step={50}
              value={setting.kelvin}
              onChange={(value) => props.onChange({ ...setting, kelvin: value })}
              disabled={!setting.power || props.disabled}
            />
          </Stack>
        ) : (
          <Stack gap={6}>
            <Text size='xs' c='dimmed'>
              Color
            </Text>
            <ColorPicker
              format='hex'
              value={colorHexFromControls({
                hue: setting.hue,
                saturation: setting.saturation,
                brightness: setting.brightness,
              })}
              onChange={handleColorChange}
              fullWidth
            />
            <Group justify='space-between'>
              <Text size='xs' c='dimmed'>
                Hue {Math.round(setting.hue)}°
              </Text>
              <Text size='xs' c='dimmed'>
                Sat {Math.round(setting.saturation)}%
              </Text>
            </Group>
          </Stack>
        )}

        <Stack gap={6}>
          <Group justify='space-between'>
            <Text size='xs' c='dimmed'>
              Brightness
            </Text>
            <Text size='xs' c='dimmed'>
              {Math.round(setting.brightness)}%
            </Text>
          </Group>
          <Slider
            min={0}
            max={100}
            step={1}
            value={setting.brightness}
            onChange={(value) => props.onChange({ ...setting, brightness: value })}
            disabled={!setting.power || props.disabled}
          />
        </Stack>
      </Stack>
    </Card>
  )
}

function PresetSettingSummaryCard(props: {
  index: number
  setting: PresetLightSetting
  lightById: Map<string, LightRecord>
}) {
  const preview =
    props.setting.power === false
      ? 'rgba(255, 255, 255, 0.08)'
      : typeof props.setting.kelvin === 'number'
      ? kelvinToRgbCss(props.setting.kelvin, props.setting.brightness ?? 100)
      : colorHexFromControls({
          hue: props.setting.hue ?? 0,
          saturation: props.setting.saturation ?? 100,
          brightness: props.setting.brightness ?? 100,
        })

  return (
    <Card withBorder radius='md' p='md'>
      <Stack gap='md'>
        <Group justify='space-between' align='flex-start'>
          <Stack gap={2}>
            <Group gap='xs'>
              <Badge variant='light'>Rule {String(props.index + 1).padStart(2, '0')}</Badge>
              <Text fw={700}>{targetLabel(props.setting.lightId, props.lightById)}</Text>
            </Group>
            <Text size='xs' c='dimmed'>
              {typeof props.setting.kelvin === 'number'
                ? `${props.setting.kelvin}K`
                : `Hue ${props.setting.hue ?? 0}°, Sat ${props.setting.saturation ?? 100}%`}
              {' · '}
              Brightness {props.setting.brightness ?? 100}%
              {' · '}
              {props.setting.power === false ? 'Power off' : 'Power on'}
            </Text>
          </Stack>
          <Paper
            withBorder
            radius='md'
            p='md'
            style={{
              width: 140,
              minHeight: 88,
              background: preview,
              opacity: props.setting.power === false ? 0.45 : 1,
            }}
          />
        </Group>
      </Stack>
    </Card>
  )
}

function PresetDetailView(props: {
  draft: PresetDraft | null
  activePreset: LightPreset | null
  lightOptions: Array<{ value: string; label: string }>
  lightById: Map<string, LightRecord>
  presetBusyId: string | null
  presetSaving: boolean
  onClose: () => void
  onNameChange: (name: string) => void
  onAddAllRule: () => void
  onAddLight: () => void
  onBringInAllLights: () => void
  onUpdateSetting: (key: string, next: PresetSettingDraft) => void
  onRemoveSetting: (key: string) => void
  onSave: () => Promise<void>
  onApply: (presetId: string) => Promise<void>
  onOpenEditor: (preset: LightPreset) => void
}) {
  if (props.draft) {
    const draft = props.draft
    const ruleCount = draft.settings.length

    return (
      <Stack gap='md'>
        <OpsPageHeader
          compact
          title={draft.id ? draft.name || 'Preset Detail' : 'New Preset'}
          description='Build the preset as a dedicated editor with explicit per-light rules.'
          breadcrumbs={[
            { label: 'Lights', onClick: props.onClose },
            { label: 'Presets', onClick: props.onClose },
            { label: draft.id ? draft.name || 'Preset Detail' : 'New Preset' },
          ]}
          meta={
            <>
              <Badge variant='light'>{ruleCount} rules</Badge>
              {draft.isPredefined ? (
                <Badge color='gray' variant='light'>
                  System
                </Badge>
              ) : null}
            </>
          }
          actions={
            <Button variant='light' onClick={props.onClose} disabled={props.presetSaving}>
              Back
            </Button>
          }
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
          <TextInput
            label='Name'
            placeholder='Evening Warm'
            value={draft.name}
            onChange={(event) => props.onNameChange(event.currentTarget.value)}
            disabled={draft.isPredefined || props.presetSaving}
          />
          <Paper withBorder radius='md' p='md'>
            <Stack gap={4}>
              <Text fw={600}>Preset Summary</Text>
              <Text size='sm' c='dimmed'>
                {ruleCount === 0
                  ? 'No rules defined yet.'
                  : `${ruleCount} rule${ruleCount === 1 ? '' : 's'} targeting ${
                      new Set(draft.settings.map((setting) => setting.lightId)).size
                    } destination${new Set(draft.settings.map((setting) => setting.lightId)).size === 1 ? '' : 's'}.`}
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>

        {!draft.isPredefined ? (
          <OpsToolbar>
            <Group justify='space-between' align='center' wrap='wrap'>
              <Stack gap={2}>
                <Text fw={700}>Rules</Text>
                <Text size='xs' c='dimmed'>
                  Add broad rules first, then override specific lights as needed.
                </Text>
              </Stack>
              <Group gap='xs'>
                <Button size='xs' variant='light' onClick={props.onAddAllRule} disabled={props.presetSaving}>
                  Add All-Lights Rule
                </Button>
                <Button size='xs' variant='light' onClick={props.onAddLight} disabled={props.presetSaving}>
                  Add Light
                </Button>
                <Button
                  size='xs'
                  variant='light'
                  onClick={props.onBringInAllLights}
                  disabled={props.presetSaving}
                >
                  Bring In All Lights
                </Button>
              </Group>
            </Group>
          </OpsToolbar>
        ) : null}

        {ruleCount > 0 ? (
          <Stack gap='md'>
            {draft.settings.map((setting, index) => (
              <PresetSettingCard
                key={setting.key}
                index={index}
                setting={setting}
                lightOptions={props.lightOptions}
                lightById={props.lightById}
                disabled={draft.isPredefined || props.presetSaving}
                onChange={(next) => props.onUpdateSetting(setting.key, next)}
                onRemove={() => props.onRemoveSetting(setting.key)}
              />
            ))}
          </Stack>
        ) : (
          <Paper withBorder radius='md' p='xl'>
            <Stack gap={6} align='center'>
              <Text fw={700}>No rules yet</Text>
              <Text size='sm' c='dimmed'>
                Add an all-lights rule or bring specific lights into the preset to start editing.
              </Text>
            </Stack>
          </Paper>
        )}

        {!draft.isPredefined ? (
          <OpsFormDock
            primaryLabel={draft.id ? 'Save Preset' : 'Create Preset'}
            onPrimary={() => void props.onSave()}
            primaryLoading={props.presetSaving}
            secondaryLabel='Back'
            onSecondary={props.onClose}
            secondaryDisabled={props.presetSaving}
            aside={
              <Text size='xs' c='dimmed'>
                Presets are persisted in the controller database.
              </Text>
            }
          />
        ) : props.activePreset ? (
          <OpsFormDock
            primaryLabel='Apply Preset'
            onPrimary={() => void props.onApply(props.activePreset!.id)}
            primaryLoading={props.presetBusyId === props.activePreset.id}
            secondaryLabel='Back'
            onSecondary={props.onClose}
          />
        ) : null}
      </Stack>
    )
  }

  if (props.activePreset) {
    const activePreset = props.activePreset

    return (
      <Stack gap='md'>
        <OpsPageHeader
          compact
          title={activePreset.name}
          description='Inspect the preset as a dedicated detail screen, then apply or open it for editing.'
          breadcrumbs={[
            { label: 'Lights', onClick: props.onClose },
            { label: 'Presets', onClick: props.onClose },
            { label: activePreset.name },
          ]}
          meta={
            <>
              <Badge variant='light'>{activePreset.settings.length} rules</Badge>
              {activePreset.isPredefined ? (
                <Badge color='gray' variant='light'>
                  System
                </Badge>
              ) : null}
            </>
          }
          actions={
            <Group gap='xs'>
              <Button variant='light' onClick={() => props.onOpenEditor(activePreset)}>
                {activePreset.isPredefined ? 'Inspect In Editor' : 'Edit'}
              </Button>
              <Button variant='light' onClick={props.onClose}>
                Back
              </Button>
            </Group>
          }
        />

        <Paper withBorder radius='md' p='md'>
          <Stack gap={4}>
            <Text fw={700}>Preset Summary</Text>
            <Text size='sm' c='dimmed'>
              {settingsSummary(activePreset, props.lightById)}
            </Text>
          </Stack>
        </Paper>

        <Stack gap='md'>
          {activePreset.settings.map((setting, index) => (
            <PresetSettingSummaryCard
              key={`${activePreset.id}-${index}`}
              index={index}
              setting={setting}
              lightById={props.lightById}
            />
          ))}
        </Stack>

        <OpsFormDock
          primaryLabel='Apply Preset'
          onPrimary={() => void props.onApply(activePreset.id)}
          primaryLoading={props.presetBusyId === activePreset.id}
          secondaryLabel='Back'
          onSecondary={props.onClose}
        />
      </Stack>
    )
  }

  return (
    <Stack gap='sm' justify='center' style={{ minHeight: 240 }}>
      <Title order={5}>Preset Detail</Title>
      <Text size='sm' c='dimmed'>
        Select a preset to inspect it, or create a new preset with per-light settings.
      </Text>
    </Stack>
  )
}

export function LightsScreen() {
  const [lights, setLights] = useState<LightRecord[]>([])
  const [presets, setPresets] = useState<LightPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [allControlBusy, setAllControlBusy] = useState(false)
  const [presetBusyId, setPresetBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [lightEditorOpen, setLightEditorOpen] = useState(false)
  const [lightEditorSaving, setLightEditorSaving] = useState(false)
  const [editingLightId, setEditingLightId] = useState<string | null>(null)
  const [lightForm, setLightForm] = useState<LightForm>(emptyLightForm())

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importSaving, setImportSaving] = useState(false)

  const [presetDraft, setPresetDraft] = useState<PresetDraft | null>(null)
  const [presetSaving, setPresetSaving] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)

  const lightById = useMemo(() => new Map(lights.map((light) => [light.id, light])), [lights])
  const lightOptions = useMemo(
    () => [
      { value: '*', label: 'All lights' },
      ...lights.map((light) => ({
        value: light.id,
        label: `${light.name} (${light.id})`,
      })),
    ],
    [lights]
  )

  const refresh = useCallback(async (opts?: { initial?: boolean }) => {
    if (opts?.initial) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      const [nextLights, nextPresets] = await Promise.all([fetchLights(), fetchPresets()])
      setLights(nextLights)
      setPresets(nextPresets)
      setError(null)
      setSelectedPresetId((current) => {
        if (!current) return current
        return nextPresets.some((preset) => preset.id === current) ? current : null
      })
      setPresetDraft((current) => {
        if (!current?.id) return current
        const latest = nextPresets.find((preset) => preset.id === current.id)
        if (!latest) return null
        return current.isPredefined ? presetDraftFromPreset(latest) : current
      })
    } catch (err) {
      setError(toReadableError(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh({ initial: true })
  }, [refresh])

  const handleControlLight = useCallback(async (lightId: string, request: LightControlRequest) => {
    await controlLight(lightId, request)
    const nextLights = await fetchLights()
    setLights(nextLights)
  }, [])

  const openCreateLight = () => {
    setEditingLightId(null)
    setLightForm(emptyLightForm())
    setLightEditorOpen(true)
  }

  const openEditLight = (light: LightRecord) => {
    setEditingLightId(light.id)
    setLightForm(lightFormFromRecord(light))
    setLightEditorOpen(true)
  }

  const closeLightEditor = () => {
    setLightEditorOpen(false)
    setEditingLightId(null)
    setLightForm(emptyLightForm())
    setLightEditorSaving(false)
  }

  const handleSaveLight = async () => {
    const trimmedName = lightForm.name.trim()
    const trimmedIp = lightForm.ipAddress.trim()
    if (!trimmedName) {
      notifications.show({
        color: 'red',
        title: 'Light name required',
        message: 'Enter a name before saving.',
      })
      return
    }
    if (!trimmedIp) {
      notifications.show({
        color: 'red',
        title: 'IP address required',
        message: 'Enter an IP address before saving.',
      })
      return
    }

    const payload: LightUpsertInput = {
      ...(editingLightId ? {} : lightForm.id.trim() ? { id: lightForm.id.trim() } : {}),
      name: trimmedName,
      ipAddress: trimmedIp,
      ...(lightForm.port.trim() ? { port: Number(lightForm.port) } : {}),
      ...(lightForm.deviceId.trim() ? { deviceId: lightForm.deviceId.trim() } : {}),
      ...(lightForm.sku.trim() ? { sku: lightForm.sku.trim() } : {}),
      ...(lightForm.deviceType.trim() ? { deviceType: lightForm.deviceType.trim() } : {}),
    }

    setLightEditorSaving(true)
    try {
      if (editingLightId) {
        await updateLight(editingLightId, payload)
      } else {
        await createLight(payload)
      }
      notifications.show({
        color: 'green',
        title: editingLightId ? 'Light updated' : 'Light created',
        message: trimmedName,
      })
      closeLightEditor()
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: editingLightId ? 'Update failed' : 'Create failed',
        message: toReadableError(err),
      })
      setLightEditorSaving(false)
    }
  }

  const handleDeleteLight = async (light: LightRecord) => {
    try {
      await deleteLight(light.id)
      notifications.show({
        color: 'green',
        title: 'Light deleted',
        message: light.name,
      })
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: toReadableError(err),
      })
    }
  }

  const closeImportModal = () => {
    setImportOpen(false)
    setImportText('')
    setImportSaving(false)
  }

  const handleImportLights = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(importText)
    } catch {
      notifications.show({
        color: 'red',
        title: 'Invalid JSON',
        message: 'Paste a JSON array or a legacy lights.json object.',
      })
      return
    }

    const rawLights = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { lights?: unknown }).lights)
      ? (parsed as { lights: unknown[] }).lights
      : null

    if (!rawLights) {
      notifications.show({
        color: 'red',
        title: 'Invalid import payload',
        message: 'Expected an array of lights or an object with a lights array.',
      })
      return
    }

    setImportSaving(true)
    try {
      const result = await importLights({
        lights: rawLights as LightImportInput[],
      })
      notifications.show({
        color: 'green',
        title: 'Lights imported',
        message: `Imported ${result.imported}, added ${result.added}, updated ${result.updated}`,
      })
      closeImportModal()
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Import failed',
        message: toReadableError(err),
      })
      setImportSaving(false)
    }
  }

  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      const result = await discoverLights({ timeout: 5000 })
      notifications.show({
        color: 'green',
        title: 'Discovery complete',
        message: `Found ${result.discovered}, added ${result.added}, updated ${result.updated}`,
      })
      await refresh()
    } catch (err) {
      const message = toReadableError(err)
      setError(message)
      notifications.show({
        color: 'red',
        title: 'Discovery failed',
        message,
      })
    } finally {
      setDiscovering(false)
    }
  }

  const handleAllControl = async (request: LightControlRequest, label: string) => {
    setAllControlBusy(true)
    try {
      await controlAllLights(request)
      notifications.show({
        color: 'green',
        title: 'All lights updated',
        message: label,
      })
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Bulk control failed',
        message: toReadableError(err),
      })
    } finally {
      setAllControlBusy(false)
    }
  }

  const handleApplyPreset = async (presetId: string) => {
    setPresetBusyId(presetId)
    try {
      await applyPreset(presetId)
      notifications.show({
        color: 'green',
        title: 'Preset applied',
        message: presets.find((preset) => preset.id === presetId)?.name ?? presetId,
      })
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Preset apply failed',
        message: toReadableError(err),
      })
    } finally {
      setPresetBusyId(null)
    }
  }

  const handleDeletePreset = async (preset: LightPreset) => {
    const confirmed = window.confirm(`Delete preset "${preset.name}"?`)
    if (!confirmed) return
    setPresetBusyId(preset.id)
    try {
      await deletePreset(preset.id)
      notifications.show({
        color: 'green',
        title: 'Preset deleted',
        message: preset.name,
      })
      if (presetDraft?.id === preset.id) setPresetDraft(null)
      setSelectedPresetId((current) => (current === preset.id ? null : current))
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: toReadableError(err),
      })
    } finally {
      setPresetBusyId(null)
    }
  }

  const openCreatePreset = () => {
    setPresetDraft(emptyPresetDraft())
    setSelectedPresetId(null)
  }

  const openPresetEditor = (preset: LightPreset) => {
    setSelectedPresetId(preset.id)
    setPresetDraft(presetDraftFromPreset(preset))
  }

  const updatePresetSettingDraft = (key: string, next: PresetSettingDraft) => {
    setPresetDraft((current) =>
      current
        ? {
            ...current,
            settings: current.settings.map((setting) => (setting.key === key ? next : setting)),
          }
        : current
    )
  }

  const addPresetSetting = (lightId = '*') => {
    setPresetDraft((current) =>
      current
        ? {
            ...current,
            settings: [...current.settings, createDraftSetting(lightId)],
          }
        : current
    )
  }

  const addAllLightsIndividually = () => {
    setPresetDraft((current) => {
      if (!current) return current
      const existing = new Set(current.settings.map((setting) => setting.lightId))
      const additions = lights
        .filter((light) => !existing.has(light.id))
        .map((light) => createDraftSetting(light.id))
      if (additions.length === 0) {
        notifications.show({
          color: 'blue',
          title: 'No lights to add',
          message: 'Every light is already included in this preset.',
        })
        return current
      }
      return {
        ...current,
        settings: [...current.settings, ...additions],
      }
    })
  }

  const removePresetSetting = (key: string) => {
    setPresetDraft((current) =>
      current
        ? {
            ...current,
            settings: current.settings.filter((setting) => setting.key !== key),
          }
        : current
    )
  }

  const handleSavePreset = async () => {
    if (!presetDraft) return

    const trimmedName = presetDraft.name.trim()
    if (!trimmedName) {
      notifications.show({
        color: 'red',
        title: 'Preset name required',
        message: 'Enter a name before saving.',
      })
      return
    }

    if (presetDraft.settings.length === 0) {
      notifications.show({
        color: 'red',
        title: 'Preset settings required',
        message: 'Add at least one light setting before saving.',
      })
      return
    }

    const duplicates = presetDraft.settings
      .map((setting) => setting.lightId)
      .filter((lightId) => lightId !== '*')
      .filter((lightId, index, values) => values.indexOf(lightId) !== index)

    if (duplicates.length > 0) {
      notifications.show({
        color: 'red',
        title: 'Duplicate preset targets',
        message: 'Each light can only appear once in the preset editor.',
      })
      return
    }

    const payload = {
      name: trimmedName,
      settings: presetDraft.settings.map(presetSettingFromDraft),
    }

    setPresetSaving(true)
    try {
      if (presetDraft.id) {
        await updatePreset(presetDraft.id, payload)
      } else {
        await createPreset(payload)
      }
      notifications.show({
        color: 'green',
        title: presetDraft.id ? 'Preset updated' : 'Preset created',
        message: trimmedName,
      })
      setPresetDraft(null)
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: presetDraft.id ? 'Preset update failed' : 'Preset create failed',
        message: toReadableError(err),
      })
    } finally {
      setPresetSaving(false)
    }
  }

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  )

  const presetDetailOpen = Boolean(presetDraft || activePreset)

  if (presetDetailOpen) {
    return (
      <Paper withBorder radius='md' p='md'>
        <PresetDetailView
          draft={presetDraft}
          activePreset={activePreset}
          lightOptions={lightOptions}
          lightById={lightById}
          presetBusyId={presetBusyId}
          presetSaving={presetSaving}
          onClose={() => {
            setPresetDraft(null)
            setSelectedPresetId(null)
          }}
          onNameChange={(name) =>
            setPresetDraft((current) =>
              current
                ? {
                    ...current,
                    name,
                  }
                : current
            )
          }
          onAddAllRule={() => addPresetSetting('*')}
          onAddLight={() => addPresetSetting(lights[0]?.id ?? '*')}
          onBringInAllLights={addAllLightsIndividually}
          onUpdateSetting={updatePresetSettingDraft}
          onRemoveSetting={removePresetSetting}
          onSave={handleSavePreset}
          onApply={handleApplyPreset}
          onOpenEditor={openPresetEditor}
        />
      </Paper>
    )
  }

  return (
    <Paper withBorder radius='md' p='md'>
      <Stack gap='md'>
        <Group justify='space-between' align='flex-start' wrap='wrap'>
          <Stack gap={2}>
            <Group gap='xs'>
              <IconBulb size={18} />
              <Title order={4}>Lights Controller</Title>
            </Group>
            <Text size='sm' c='dimmed'>
              Manage persistent light inventory, control live state, and build per-light presets.
            </Text>
          </Stack>
          <Group>
            <Button
              variant='light'
              leftSection={<IconRefresh size={14} />}
              onClick={() => void refresh()}
              loading={refreshing}
            >
              Refresh
            </Button>
            <Button
              variant='light'
              leftSection={<IconSearch size={14} />}
              onClick={() => void handleDiscover()}
              loading={discovering}
            >
              Discover
            </Button>
            <Button variant='light' leftSection={<IconUpload size={14} />} onClick={() => setImportOpen(true)}>
              Import JSON
            </Button>
            <Button leftSection={<IconPlus size={14} />} onClick={openCreateLight}>
              Add Light
            </Button>
            <Button
              variant='light'
              color='orange'
              onClick={() => void handleAllControl({ power: false }, 'All off')}
              loading={allControlBusy}
            >
              All Off
            </Button>
            <Button
              color='green'
              onClick={() =>
                void handleAllControl({ power: true, brightness: 100, kelvin: 6500 }, 'All on')
              }
              loading={allControlBusy}
            >
              All On
            </Button>
          </Group>
        </Group>

        {error ? (
          <Paper withBorder p='sm' radius='sm'>
            <Text c='red' size='sm'>
              {error}
            </Text>
          </Paper>
        ) : null}

        <Group gap='xs'>
          <Badge variant='light'>{lights.length} lights</Badge>
          <Badge color='green' variant='light'>
            {lights.filter((row) => row.reachable).length} reachable
          </Badge>
          <Badge color='gray' variant='light'>
            {presets.length} presets
          </Badge>
        </Group>

        {loading ? (
          <Group justify='center' py='xl'>
            <Loader />
          </Group>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing='md'>
            {lights.map((light) => (
              <LightControlCard
                key={light.id}
                light={light}
                onControl={handleControlLight}
                onEdit={openEditLight}
                onDelete={handleDeleteLight}
              />
            ))}
          </SimpleGrid>
        )}

        <Group justify='space-between' align='center' wrap='wrap' mt='md'>
          <Group gap='xs'>
            <IconSparkles size={16} />
            <Title order={5}>Presets</Title>
          </Group>
          <Button size='xs' variant='light' onClick={openCreatePreset}>
            Create Preset
          </Button>
        </Group>

        <Stack gap='md'>
          {presets.map((preset) => (
            <Card
              withBorder
              radius='md'
              p='md'
              key={preset.id}
              style={
                selectedPresetId === preset.id
                  ? { boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.55) inset' }
                  : undefined
              }
            >
              <Stack gap='sm'>
                <Group justify='space-between' align='flex-start'>
                  <Stack gap={2}>
                    <Text fw={700}>{preset.name}</Text>
                    <Text size='xs' c='dimmed'>
                      {settingsSummary(preset, lightById)}
                    </Text>
                  </Stack>
                  {preset.isPredefined ? (
                    <Badge size='sm' variant='light' color='gray'>
                      System
                    </Badge>
                  ) : null}
                </Group>
                <Group>
                  <Button
                    size='xs'
                    variant='light'
                    onClick={() => {
                      setSelectedPresetId(preset.id)
                      setPresetDraft(null)
                    }}
                  >
                    Inspect
                  </Button>
                  {!preset.isPredefined ? (
                    <Button size='xs' variant='light' onClick={() => openPresetEditor(preset)}>
                      Edit
                    </Button>
                  ) : null}
                  {!preset.isPredefined ? (
                    <Button
                      size='xs'
                      variant='light'
                      color='red'
                      onClick={() => void handleDeletePreset(preset)}
                      loading={presetBusyId === preset.id}
                    >
                      Delete
                    </Button>
                  ) : null}
                  <Button
                    size='xs'
                    onClick={() => void handleApplyPreset(preset.id)}
                    loading={presetBusyId === preset.id}
                  >
                    Apply
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>

      <Modal
        opened={lightEditorOpen}
        onClose={closeLightEditor}
        title={editingLightId ? 'Edit Light' : 'Add Light'}
        centered
      >
        <Stack gap='md'>
          {!editingLightId ? (
            <TextInput
              label='Id'
              placeholder='gallery-east-3'
              value={lightForm.id}
              onChange={(event) =>
                setLightForm((current) => ({ ...current, id: event.currentTarget.value }))
              }
              description='Optional. Leave blank to generate from the light name.'
            />
          ) : null}
          <TextInput
            label='Name'
            placeholder='Gallery East 3'
            value={lightForm.name}
            onChange={(event) =>
              setLightForm((current) => ({ ...current, name: event.currentTarget.value }))
            }
          />
          <TextInput
            label='IP address'
            placeholder='100.128.0.150'
            value={lightForm.ipAddress}
            onChange={(event) =>
              setLightForm((current) => ({ ...current, ipAddress: event.currentTarget.value }))
            }
          />
          <TextInput
            label='Port'
            placeholder='4003'
            value={lightForm.port}
            onChange={(event) =>
              setLightForm((current) => ({ ...current, port: event.currentTarget.value }))
            }
          />
          <TextInput
            label='Device ID'
            placeholder='optional'
            value={lightForm.deviceId}
            onChange={(event) =>
              setLightForm((current) => ({ ...current, deviceId: event.currentTarget.value }))
            }
          />
          <TextInput
            label='SKU'
            placeholder='H7039'
            value={lightForm.sku}
            onChange={(event) =>
              setLightForm((current) => ({ ...current, sku: event.currentTarget.value }))
            }
          />
          <TextInput
            label='Device type'
            placeholder='optional'
            value={lightForm.deviceType}
            onChange={(event) =>
              setLightForm((current) => ({ ...current, deviceType: event.currentTarget.value }))
            }
          />

          <Group justify='flex-end'>
            <Button variant='light' onClick={closeLightEditor} disabled={lightEditorSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveLight()} loading={lightEditorSaving}>
              {editingLightId ? 'Save Light' : 'Create Light'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={importOpen}
        onClose={closeImportModal}
        title='Import Lights JSON'
        centered
        size='lg'
      >
        <Stack gap='md'>
          <Text size='sm' c='dimmed'>
            Paste the legacy `lights.json` object or a raw array of light records. Imported lights are persisted in the controller database.
          </Text>
          <Textarea
            minRows={12}
            autosize
            value={importText}
            onChange={(event) => setImportText(event.currentTarget.value)}
            placeholder='{"lights":[{"id":"a","name":"Auditorium","ip":"100.128.0.144","deviceId":"..."}],"port":4003}'
          />
          <Group justify='flex-end'>
            <Button variant='light' onClick={closeImportModal} disabled={importSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleImportLights()} loading={importSaving}>
              Import Lights
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}
