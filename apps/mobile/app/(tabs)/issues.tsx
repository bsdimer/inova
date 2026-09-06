import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../../src/components/AppBackground';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GlassView } from '../../src/components/GlassView';
import { PressableScale } from '../../src/components/PressableScale';
import { BrandLockup } from '../../src/components/SosedoLogo';
import { metrics, rs } from '../../src/theme/responsive';
import { darkTheme, glass, palette, radius } from '../../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

type SignalStatus = 'reported' | 'planned' | 'inProgress' | 'fixed';

interface Signal {
  id: string;
  title: string;
  date: string;
  category: string;
  categoryIcon: IconName;
  status: SignalStatus;
  description?: string;
  photoUri?: string;
}

const STATUS_META: Record<SignalStatus, { label: string; color: string }> = {
  reported: { label: 'Докладван', color: darkTheme.danger },
  planned: { label: 'Планиран', color: palette.stone },
  inProgress: { label: 'В процес', color: palette.orangeBright },
  fixed: { label: 'Оправена', color: darkTheme.success },
};

const FILTERS: { key: SignalStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Всички' },
  { key: 'reported', label: 'Докладвани' },
  { key: 'planned', label: 'Планирани' },
  { key: 'inProgress', label: 'В процес' },
  { key: 'fixed', label: 'Оправени' },
];

const CATEGORIES: { id: string; label: string; icon: IconName }[] = [
  { id: 'maintenance', label: 'Поддръжка', icon: 'construct-outline' },
  { id: 'cleaning', label: 'Чистота', icon: 'sparkles-outline' },
  { id: 'urgent', label: 'Спешно', icon: 'warning-outline' },
  { id: 'other', label: 'Други', icon: 'ellipsis-horizontal' },
];

const BG_MONTHS = [
  'януари',
  'февруари',
  'март',
  'април',
  'май',
  'юни',
  'юли',
  'август',
  'септември',
  'октомври',
  'ноември',
  'декември',
];

function formatToday(): string {
  const now = new Date();
  return `${now.getDate()} ${BG_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

// TODO(M6): issues module — submission + history come from the issues API.
const MOCK_SIGNALS: Signal[] = [
  {
    id: 's1',
    title: 'Изгоряла крушка ет. 1',
    date: '14 май 2026',
    category: 'Поддръжка',
    categoryIcon: 'construct-outline',
    status: 'fixed',
  },
  {
    id: 's2',
    title: 'Разсипан боклук до асансьора',
    date: '13 май 2026',
    category: 'Чистота',
    categoryIcon: 'sparkles-outline',
    status: 'inProgress',
  },
  {
    id: 's3',
    title: 'Теч от тавана в мазето',
    date: '12 май 2026',
    category: 'Спешно',
    categoryIcon: 'warning-outline',
    status: 'reported',
  },
  {
    id: 's4',
    title: 'Драскотини по стената на ет. 3',
    date: '10 май 2026',
    category: 'Други',
    categoryIcon: 'ellipsis-horizontal',
    status: 'planned',
  },
];

function SignalCard({ signal, onPress }: { signal: Signal; onPress: () => void }) {
  const status = STATUS_META[signal.status];

  return (
    <PressableScale
      haptic={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${signal.title}, ${status.label}`}
    >
      <GlassView
        rounded={radius.md}
        intensity={50}
        overlayColor="rgba(255,255,255,0.1)"
        borderColor="rgba(255,255,255,0.32)"
        contentStyle={styles.signalCard}
      >
        <View style={styles.signalBadges}>
          <View style={styles.badge}>
            <Ionicons name="alert-circle-outline" size={rs(13, 12)} color={glass.textSecondary} />
            <Text style={styles.badgeText}>Сигнал</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name={signal.categoryIcon} size={rs(13, 12)} color={glass.textSecondary} />
            <Text style={styles.badgeText}>{signal.category}</Text>
          </View>
        </View>
        <View style={styles.signalMain}>
          <View style={styles.signalTexts}>
            <Text style={styles.signalTitle} numberOfLines={1}>
              {signal.title}
            </Text>
            <Text style={styles.signalDate}>{signal.date}</Text>
          </View>
          <View style={styles.signalStatus}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={styles.statusLabel}>{status.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={rs(17, 15)} color={glass.textSecondary} />
        </View>
      </GlassView>
    </PressableScale>
  );
}

/** Full-detail preview of a signal (opened from a card or right after submit). */
function SignalPreview({ signal, onClose }: { signal: Signal | null; onClose: () => void }) {
  const status = signal ? STATUS_META[signal.status] : null;

  return (
    <Modal visible={!!signal} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Затвори прегледа"
          style={styles.previewBackdropTap}
        />
        {signal && status ? (
          <Animated.View entering={FadeInUp.duration(320)} style={styles.previewCardWrap}>
            <GlassView
              rounded={radius.lg}
              intensity={70}
              overlayColor="rgba(30,26,23,0.72)"
              borderColor="rgba(255,255,255,0.35)"
              contentStyle={styles.previewCard}
            >
              <View style={styles.previewHeader}>
                <View style={styles.signalBadges}>
                  <View style={styles.badge}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={rs(13, 12)}
                      color={glass.textSecondary}
                    />
                    <Text style={styles.badgeText}>Сигнал</Text>
                  </View>
                  <View style={styles.badge}>
                    <Ionicons
                      name={signal.categoryIcon}
                      size={rs(13, 12)}
                      color={glass.textSecondary}
                    />
                    <Text style={styles.badgeText}>{signal.category}</Text>
                  </View>
                </View>
                <GlassCircleButton icon="close" onPress={onClose} accessibilityLabel="Затвори" />
              </View>

              <Text style={styles.previewTitle}>{signal.title}</Text>
              <View style={styles.previewMeta}>
                <Text style={styles.signalDate}>{signal.date}</Text>
                <View style={styles.signalStatus}>
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                  <Text style={styles.statusLabel}>{status.label}</Text>
                </View>
              </View>

              {signal.description ? (
                <Text style={styles.previewDescription}>{signal.description}</Text>
              ) : null}

              {signal.photoUri ? (
                <Image
                  source={{ uri: signal.photoUri }}
                  style={styles.previewPhoto}
                  resizeMode="cover"
                  accessibilityLabel="Снимка към сигнала"
                />
              ) : null}
            </GlassView>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

export default function Issues() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // TODO(M6): form state + created signals submit to the issues API; local-only for now.
  const [category, setCategory] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>(MOCK_SIGNALS);
  const [filter, setFilter] = useState<SignalStatus | 'all'>('all');
  const [preview, setPreview] = useState<Signal | null>(null);

  const visibleSignals = useMemo(
    () => (filter === 'all' ? signals : signals.filter((s) => s.status === filter)),
    [filter, signals],
  );

  const selectedCategory = CATEGORIES.find((c) => c.id === category);

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Няма достъп', 'Разрешете достъп до галерията от настройките.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Няма достъп', 'Разрешете достъп до камерата от настройките.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const chooseAttachment = () => {
    Alert.alert('Прикачи снимка', 'Снимката не е задължителна.', [
      { text: 'От галерията', onPress: () => void pickFromGallery() },
      { text: 'Направи снимка', onPress: () => void takePhoto() },
      { text: 'Отказ', style: 'cancel' },
    ]);
  };

  const submit = () => {
    if (!selectedCategory) {
      Alert.alert('Липсва категория', 'Моля, изберете категория на сигнала.');
      return;
    }
    const trimmed = description.trim();
    if (!trimmed) {
      Alert.alert('Липсва описание', 'Моля, опишете проблема накратко.');
      return;
    }

    // TODO(M6): POST to the issues API; local-only mock for now.
    const created: Signal = {
      id: `local-${Date.now()}`,
      // First line of the description doubles as the card title.
      title: trimmed.split('\n')[0],
      date: formatToday(),
      category: selectedCategory.label,
      categoryIcon: selectedCategory.icon,
      status: 'reported',
      description: trimmed,
      photoUri: photoUri ?? undefined,
    };
    setSignals((prev) => [created, ...prev]);
    setCategory(null);
    setDescription('');
    setPhotoUri(null);
    setFilter('all');
    setPreview(created);
  };

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      <View style={styles.darkScrim} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + rs(16, 10), paddingBottom: insets.bottom + rs(116, 102) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerRow}>
          <BrandLockup />
          <GlassCircleButton
            icon="ellipsis-horizontal"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(60)}>
          <Text style={styles.title}>Сигнализирайте{'\n'}за нередност</Text>
        </Animated.View>

        {/* Category selector */}
        <Animated.View entering={FadeInUp.duration(420).delay(120)} style={styles.formBlock}>
          <PressableScale
            haptic={false}
            onPress={() => setCategoryOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Избери категория"
            style={styles.selectRow}
          >
            {selectedCategory ? (
              <Ionicons name={selectedCategory.icon} size={rs(18, 16)} color={glass.textPrimary} />
            ) : null}
            <Text style={selectedCategory ? styles.selectValue : styles.selectPlaceholder}>
              {selectedCategory ? selectedCategory.label : 'Категория'}
            </Text>
            <Ionicons
              name={categoryOpen ? 'chevron-up' : 'chevron-down'}
              size={rs(18, 16)}
              color={glass.textSecondary}
            />
          </PressableScale>
          {categoryOpen ? (
            <View style={styles.selectList}>
              {CATEGORIES.map((c, i) => (
                <PressableScale
                  key={c.id}
                  haptic={false}
                  onPress={() => {
                    setCategory(c.id);
                    setCategoryOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  style={[
                    styles.selectOption,
                    ...(i < CATEGORIES.length - 1 ? [styles.selectOptionBorder] : []),
                  ]}
                >
                  <Ionicons name={c.icon} size={rs(17, 15)} color={glass.textPrimary} />
                  <Text style={styles.selectOptionText}>{c.label}</Text>
                  {category === c.id ? (
                    <Ionicons name="checkmark" size={rs(16, 14)} color={glass.textPrimary} />
                  ) : null}
                </PressableScale>
              ))}
            </View>
          ) : null}

          {/* Description */}
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionLabel}>Описание</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Опишете проблема"
              placeholderTextColor={glass.textMuted}
              multiline
              textAlignVertical="top"
              style={styles.descriptionInput}
              accessibilityLabel="Описание на проблема"
            />
          </View>

          {/* Photo attach — optional */}
          <PressableScale
            haptic={false}
            onPress={chooseAttachment}
            accessibilityRole="button"
            accessibilityLabel="Прикачи снимка, не е задължителна"
            style={styles.attachRow}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.attachThumb}
                accessibilityLabel="Прикачена снимка"
              />
            ) : null}
            <View style={styles.attachTexts}>
              <Text style={styles.attachLabel}>
                {photoUri ? 'Снимката е прикачена' : 'Прикачи снимка'}
              </Text>
              <Text style={styles.attachHint}>
                {photoUri ? 'Докосни, за да я смениш' : 'Не е задължителна'}
              </Text>
            </View>
            {photoUri ? (
              <PressableScale
                haptic={false}
                onPress={() => setPhotoUri(null)}
                accessibilityRole="button"
                accessibilityLabel="Премахни снимката"
                style={styles.attachButton}
              >
                <Ionicons name="close" size={rs(18, 16)} color={glass.textPrimary} />
              </PressableScale>
            ) : (
              <View style={styles.attachButton}>
                <Ionicons name="add" size={rs(20, 18)} color={glass.textPrimary} />
              </View>
            )}
          </PressableScale>

          <PressableScale
            haptic={false}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="Изпрати сигнал"
            style={styles.submit}
          >
            <Text style={styles.submitLabel}>Изпрати</Text>
          </PressableScale>
        </Animated.View>

        {/* History */}
        <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.historyBlock}>
          <Text style={styles.sectionTitle}>История на сигналите</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <PressableScale
                  key={f.key}
                  haptic={false}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={f.label}
                  style={[styles.filterChip, ...(active ? [styles.filterChipActive] : [])]}
                >
                  <Text style={[styles.filterText, ...(active ? [styles.filterTextActive] : [])]}>
                    {f.label}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          <View style={styles.signalList}>
            {visibleSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} onPress={() => setPreview(signal)} />
            ))}
            {visibleSignals.length === 0 ? (
              <Text style={styles.emptyText}>Няма сигнали в тази категория.</Text>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

      <SignalPreview signal={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  darkScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(24,20,17,0.45)',
  },
  scroll: {
    paddingHorizontal: metrics.screenPadding,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    marginTop: rs(18, 14),
    fontSize: rs(32, 28),
    lineHeight: rs(38, 34),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  formBlock: {
    marginTop: rs(18, 14),
    gap: rs(12, 10),
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
    minHeight: metrics.inputHeight,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.stroke,
    backgroundColor: glass.fill,
    paddingHorizontal: rs(16, 14),
  },
  selectValue: {
    flex: 1,
    fontSize: metrics.bodySize,
    fontWeight: '600',
    color: glass.textPrimary,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: metrics.bodySize,
    fontWeight: '500',
    color: glass.textSecondary,
  },
  selectList: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.stroke,
    backgroundColor: glass.fill,
    overflow: 'hidden',
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
    paddingVertical: rs(13, 11),
    paddingHorizontal: rs(16, 14),
  },
  selectOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  selectOptionText: {
    flex: 1,
    fontSize: rs(15, 14),
    fontWeight: '500',
    color: glass.textPrimary,
  },
  descriptionBox: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.stroke,
    backgroundColor: glass.fill,
    paddingHorizontal: rs(16, 14),
    paddingVertical: rs(12, 10),
    gap: rs(4, 3),
  },
  descriptionLabel: {
    fontSize: rs(14, 13),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  descriptionInput: {
    minHeight: rs(72, 62),
    fontSize: metrics.bodySize,
    color: glass.textPrimary,
    paddingTop: rs(2, 2),
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12, 10),
    minHeight: metrics.inputHeight,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.stroke,
    backgroundColor: glass.fill,
    paddingHorizontal: rs(16, 14),
    paddingVertical: rs(10, 8),
  },
  attachThumb: {
    width: rs(44, 38),
    height: rs(44, 38),
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  attachTexts: {
    flex: 1,
    gap: rs(2, 1),
  },
  attachLabel: {
    fontSize: metrics.bodySize,
    fontWeight: '500',
    color: glass.textSecondary,
  },
  attachHint: {
    fontSize: rs(12, 11),
    color: glass.textMuted,
  },
  attachButton: {
    width: rs(34, 30),
    height: rs(34, 30),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: metrics.buttonHeight,
    borderRadius: 999,
    backgroundColor: 'rgba(20,18,17,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  submitLabel: {
    fontSize: rs(16, 15),
    fontWeight: '700',
    color: palette.white,
  },
  historyBlock: {
    marginTop: rs(22, 18),
    gap: rs(12, 10),
  },
  sectionTitle: {
    fontSize: rs(18, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  filters: {
    gap: rs(8, 6),
    paddingRight: rs(8, 6),
  },
  filterChip: {
    paddingVertical: rs(9, 8),
    paddingHorizontal: rs(14, 12),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: palette.goldBlack,
    borderColor: palette.goldBlack,
  },
  filterText: {
    fontSize: rs(13, 12),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  filterTextActive: {
    fontWeight: '700',
    color: palette.white,
  },
  signalList: {
    gap: rs(10, 8),
  },
  signalCard: {
    paddingVertical: rs(12, 10),
    paddingHorizontal: rs(14, 12),
    gap: rs(8, 6),
  },
  signalBadges: {
    flexDirection: 'row',
    gap: rs(8, 6),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5, 4),
    paddingVertical: rs(4, 3),
    paddingHorizontal: rs(9, 8),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  badgeText: {
    fontSize: rs(11, 10),
    fontWeight: '600',
    color: glass.textSecondary,
  },
  signalMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
  },
  signalTexts: {
    flex: 1,
    gap: rs(2, 1),
  },
  signalTitle: {
    fontSize: rs(15, 14),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  signalDate: {
    fontSize: rs(12, 11),
    color: glass.textSecondary,
  },
  signalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6, 5),
  },
  statusDot: {
    width: rs(8, 7),
    height: rs(8, 7),
    borderRadius: 999,
  },
  statusLabel: {
    fontSize: rs(13, 12),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  emptyText: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
    textAlign: 'center',
    paddingVertical: rs(16, 14),
  },
  previewBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: metrics.screenPadding,
    backgroundColor: 'rgba(15,13,11,0.55)',
  },
  previewBackdropTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  previewCardWrap: {
    borderRadius: radius.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  },
  previewCard: {
    padding: rs(18, 15),
    gap: rs(12, 10),
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(10, 8),
  },
  previewTitle: {
    fontSize: rs(20, 18),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewDescription: {
    fontSize: rs(15, 14),
    lineHeight: rs(21, 19),
    color: glass.textSecondary,
  },
  previewPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
