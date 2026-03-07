import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import {
  IconBulb,
  IconDeviceFloppy,
  IconRefresh,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  applyPreset,
  controlAllLights,
  controlLight,
  createPreset,
  deletePreset,
  discoverLights,
  fetchLights,
  fetchPresets,
  type LightControlRequest,
  type LightPreset,
  type LightRecord,
  type PresetLightSetting,
} from '../../lib/deviceApi'

type ControlMode = 'color' | 'temperature'

function toReadableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function kelvinToRgbCss(kelvin: number, brightness: number): string {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100
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

  const br = Math.max(0, Math.min(100, brightness)) / 100
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value * br)))
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
}

function colorPreview(args: {
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
  const lightness = Math.max(5, Math.min(95, (args.brightness / 100) * 50))
  return `hsl(${args.hue}, ${args.saturation}%, ${lightness}%)`
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

function settingsSummary(preset: LightPreset): string {
  if (preset.settings.some((row) => row.lightId === '*')) return 'All lights'
  return `${preset.settings.length} light${preset.settings.length === 1 ? '' : 's'}`
}

function LightControlCard(props: {
  light: LightRecord
  onControl: (lightId: string, request: LightControlRequest) => Promise<void>
}) {
  const { light } = props
  const [busy, setBusy] = useState(false)
  const [power, setPower] = useState(light.state?.power ?? false)
  const [mode, setMode] = useState<ControlMode>(light.state?.kelvin ? 'temperature' : 'color')
  const [hue, setHue] = useState(light.state?.hue ?? 0)
  const [saturation, setSaturation] = useState(light.state?.saturation ?? 100)
  const [brightness, setBrightness] = useState(light.state?.brightness ?? 100)
  const [kelvin, setKelvin] = useState(light.state?.kelvin ?? 4000)

  useEffect(() => {
    setPower(light.state?.power ?? false)
    setHue(light.state?.hue ?? 0)
    setSaturation(light.state?.saturation ?? 100)
    setBrightness(light.state?.brightness ?? 100)
    setKelvin(light.state?.kelvin ?? 4000)
    setMode(light.state?.kelvin ? 'temperature' : 'color')
  }, [light])

  const preview = colorPreview({
    power,
    mode,
    hue,
    saturation,
    brightness,
    kelvin,
  })

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

  return (
    <Card withBorder radius='md' p='md'>
      <Stack gap='sm'>
        <Group justify='space-between' align='flex-start'>
          <Stack gap={2}>
            <Group gap='xs'>
              <Text fw={700}>{light.name}</Text>
              {light.sku ? (
                <Badge variant='light' size='xs' color='gray'>
                  {light.sku}
                </Badge>
              ) : null}
            </Group>
            <Text size='xs' c='dimmed'>
              {light.ipAddress}
            </Text>
          </Stack>
          <Badge color={light.reachable ? 'green' : 'gray'} variant='light'>
            {light.reachable ? 'Reachable' : 'Offline'}
          </Badge>
        </Group>

        <Paper
          withBorder
          radius='sm'
          p='xs'
          style={{
            background: preview,
            minHeight: 40,
            opacity: power ? 1 : 0.45,
          }}
        />

        <Group justify='space-between'>
          <Text size='sm'>Power</Text>
          <Switch checked={power} onChange={togglePower} disabled={busy} />
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
          disabled={!power || busy}
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
              disabled={!power || busy}
            />
          </Stack>
        ) : (
          <>
            <Stack gap={6}>
              <Group justify='space-between'>
                <Text size='xs' c='dimmed'>
                  Hue
                </Text>
                <Text size='xs' c='dimmed'>
                  {Math.round(hue)}°
                </Text>
              </Group>
              <Slider
                min={0}
                max={360}
                step={1}
                value={hue}
                onChange={setHue}
                disabled={!power || busy}
              />
            </Stack>
            <Stack gap={6}>
              <Group justify='space-between'>
                <Text size='xs' c='dimmed'>
                  Saturation
                </Text>
                <Text size='xs' c='dimmed'>
                  {Math.round(saturation)}%
                </Text>
              </Group>
              <Slider
                min={0}
                max={100}
                step={1}
                value={saturation}
                onChange={setSaturation}
                disabled={!power || busy}
              />
            </Stack>
          </>
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
            disabled={!power || busy}
          />
        </Stack>

        <Button
          leftSection={<IconDeviceFloppy size={14} />}
          onClick={() => void apply()}
          loading={busy}
          variant='light'
        >
          Apply
        </Button>
      </Stack>
    </Card>
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

  const [createPresetOpen, setCreatePresetOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetApplyToAll, setPresetApplyToAll] = useState(true)
  const [presetLightIds, setPresetLightIds] = useState<string[]>([])
  const [presetPower, setPresetPower] = useState(true)
  const [presetMode, setPresetMode] = useState<ControlMode>('color')
  const [presetHue, setPresetHue] = useState(0)
  const [presetSaturation, setPresetSaturation] = useState(100)
  const [presetBrightness, setPresetBrightness] = useState(100)
  const [presetKelvin, setPresetKelvin] = useState(4000)
  const [presetSaving, setPresetSaving] = useState(false)

  const lightOptions = useMemo(
    () =>
      lights.map((light) => ({
        value: light.id,
        label: `${light.name} (${light.id})`,
      })),
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

  const handleControlLight = useCallback(
    async (lightId: string, request: LightControlRequest) => {
      await controlLight(lightId, request)
      const nextLights = await fetchLights()
      setLights(nextLights)
    },
    []
  )

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
        message: presetId,
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
    setPresetBusyId(preset.id)
    try {
      await deletePreset(preset.id)
      notifications.show({
        color: 'green',
        title: 'Preset deleted',
        message: preset.name,
      })
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

  const resetCreatePresetForm = () => {
    setPresetName('')
    setPresetApplyToAll(true)
    setPresetLightIds([])
    setPresetPower(true)
    setPresetMode('color')
    setPresetHue(0)
    setPresetSaturation(100)
    setPresetBrightness(100)
    setPresetKelvin(4000)
    setPresetSaving(false)
  }

  const handleCreatePreset = async () => {
    const trimmedName = presetName.trim()
    if (!trimmedName) {
      notifications.show({
        color: 'red',
        title: 'Preset name required',
        message: 'Enter a name before saving.',
      })
      return
    }

    if (!presetApplyToAll && presetLightIds.length === 0) {
      notifications.show({
        color: 'red',
        title: 'Select target lights',
        message: 'Pick at least one light, or enable "Apply to all".',
      })
      return
    }

    const base: Omit<PresetLightSetting, 'lightId'> = requestFromControls({
      power: presetPower,
      mode: presetMode,
      hue: presetHue,
      saturation: presetSaturation,
      brightness: presetBrightness,
      kelvin: presetKelvin,
    })

    const settings = (presetApplyToAll ? ['*'] : presetLightIds).map((lightId) => ({
      lightId,
      ...base,
    }))

    setPresetSaving(true)
    try {
      await createPreset({
        name: trimmedName,
        settings,
      })
      notifications.show({
        color: 'green',
        title: 'Preset created',
        message: trimmedName,
      })
      setCreatePresetOpen(false)
      resetCreatePresetForm()
      await refresh()
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Create preset failed',
        message: toReadableError(err),
      })
    } finally {
      setPresetSaving(false)
    }
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
              Discover and control smart lights directly from Ops.
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
              <LightControlCard key={light.id} light={light} onControl={handleControlLight} />
            ))}
          </SimpleGrid>
        )}

        <Group justify='space-between' align='center' wrap='wrap' mt='md'>
          <Group gap='xs'>
            <IconSparkles size={16} />
            <Title order={5}>Presets</Title>
          </Group>
          <Button
            size='xs'
            variant='light'
            onClick={() => {
              resetCreatePresetForm()
              setCreatePresetOpen(true)
            }}
          >
            Create Preset
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing='md'>
          {presets.map((preset) => (
            <Card withBorder radius='md' p='md' key={preset.id}>
              <Stack gap='sm'>
                <Group justify='space-between' align='flex-start'>
                  <Stack gap={2}>
                    <Text fw={700}>{preset.name}</Text>
                    <Text size='xs' c='dimmed'>
                      {settingsSummary(preset)}
                    </Text>
                  </Stack>
                  {preset.isPredefined ? (
                    <Badge size='sm' variant='light' color='gray'>
                      System
                    </Badge>
                  ) : null}
                </Group>
                <Group>
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
        </SimpleGrid>
      </Stack>

      <Modal
        opened={createPresetOpen}
        onClose={() => {
          setCreatePresetOpen(false)
          resetCreatePresetForm()
        }}
        title='Create Light Preset'
        centered
      >
        <Stack gap='md'>
          <TextInput
            label='Name'
            placeholder='Evening Warm'
            value={presetName}
            onChange={(event) => setPresetName(event.currentTarget.value)}
          />

          <Switch
            label='Apply to all lights'
            checked={presetApplyToAll}
            onChange={(event) => setPresetApplyToAll(event.currentTarget.checked)}
          />

          <MultiSelect
            label='Target lights'
            data={lightOptions}
            value={presetLightIds}
            onChange={setPresetLightIds}
            disabled={presetApplyToAll}
            placeholder={presetApplyToAll ? 'Using all lights' : 'Choose one or more lights'}
            searchable
          />

          <Switch
            label='Power on'
            checked={presetPower}
            onChange={(event) => setPresetPower(event.currentTarget.checked)}
          />

          <SegmentedControl
            value={presetMode}
            onChange={(value) => setPresetMode((value as ControlMode) || 'color')}
            data={[
              { label: 'Color', value: 'color' },
              { label: 'Temp', value: 'temperature' },
            ]}
            disabled={!presetPower}
            fullWidth
          />

          {presetMode === 'temperature' ? (
            <Stack gap={6}>
              <Group justify='space-between'>
                <Text size='xs' c='dimmed'>
                  Temperature
                </Text>
                <Text size='xs' c='dimmed'>
                  {Math.round(presetKelvin)}K
                </Text>
              </Group>
              <Slider
                min={2000}
                max={9000}
                step={50}
                value={presetKelvin}
                onChange={setPresetKelvin}
                disabled={!presetPower}
              />
            </Stack>
          ) : (
            <>
              <Stack gap={6}>
                <Group justify='space-between'>
                  <Text size='xs' c='dimmed'>
                    Hue
                  </Text>
                  <Text size='xs' c='dimmed'>
                    {Math.round(presetHue)}°
                  </Text>
                </Group>
                <Slider
                  min={0}
                  max={360}
                  step={1}
                  value={presetHue}
                  onChange={setPresetHue}
                  disabled={!presetPower}
                />
              </Stack>
              <Stack gap={6}>
                <Group justify='space-between'>
                  <Text size='xs' c='dimmed'>
                    Saturation
                  </Text>
                  <Text size='xs' c='dimmed'>
                    {Math.round(presetSaturation)}%
                  </Text>
                </Group>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={presetSaturation}
                  onChange={setPresetSaturation}
                  disabled={!presetPower}
                />
              </Stack>
            </>
          )}

          <Stack gap={6}>
            <Group justify='space-between'>
              <Text size='xs' c='dimmed'>
                Brightness
              </Text>
              <Text size='xs' c='dimmed'>
                {Math.round(presetBrightness)}%
              </Text>
            </Group>
            <Slider
              min={0}
              max={100}
              step={1}
              value={presetBrightness}
              onChange={setPresetBrightness}
              disabled={!presetPower}
            />
          </Stack>

          <Group justify='flex-end'>
            <Button
              variant='light'
              onClick={() => {
                setCreatePresetOpen(false)
                resetCreatePresetForm()
              }}
              disabled={presetSaving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePreset()} loading={presetSaving}>
              Save Preset
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}
