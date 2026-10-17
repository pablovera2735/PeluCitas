import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Service = 'Corte de pelo' | 'Arreglo de barba' | 'Corte + barba';
type Appointment = {
  id: number;
  service: Service;
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  appointment_time: string;
};

const SERVICES: { name: Service; price: string }[] = [
  { name: 'Corte de pelo', price: '12 €' },
  { name: 'Arreglo de barba', price: '8 €' },
  { name: 'Corte + barba', price: '18 €' },
];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function formatDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}
function inPast(key: string, time: string) {
  return new Date(`${key}T${time}:00`).getTime() <= Date.now();
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<'calendar' | 'mine' | 'admin'>('calendar');
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [adminAppointments, setAdminAppointments] = useState<Appointment[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [showAdminHistory, setShowAdminHistory] = useState(false);

  const [monthOffset, setMonthOffset] = useState(0);
  const [date, setDate] = useState<string | null>(null);
  const [hour, setHour] = useState<string | null>(null);
  const [service, setService] = useState<Service>('Corte de pelo');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [booked, setBooked] = useState<string[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [refreshHours, setRefreshHours] = useState(0);
  const [saving, setSaving] = useState(false);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session: current }, error }) => {
      if (active) {
        if (error) Alert.alert('Error de sesión', error.message);
        setSession(current);
        setLoadingAuth(false);
      }
    }).catch((e) => {
      if (active) { setLoadingAuth(false); Alert.alert('Error', String(e)); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, current) => {
      if (active) setSession(current);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session || !date) {
      setBooked([]);
      setLoadingHours(false);
      return () => { active = false; };
    }
    setLoadingHours(true);
    supabase.rpc('get_booked_slots', { p_date: date }).then(({ data, error }) => {
      if (!active) return;
      setLoadingHours(false);
      if (error) {
        setBooked([]);
        Alert.alert('Error de disponibilidad', error.message);
      } else {
        setBooked((data ?? []).map((entry: { slot: string }) => entry.slot.slice(0, 5)));
      }
    }).catch((e) => {
      if (active) { setLoadingHours(false); Alert.alert('Error', String(e)); }
    });
    return () => { active = false; };
  }, [session, date, refreshHours]);

  // No basta con ocultar el botón del panel: los permisos reales
  // los aplica Supabase mediante políticas RLS.
  useEffect(() => {
    let active = true;
    setIsAdmin(false);
    setAdminAppointments([]);
    setTab('calendar');

    if (!session) {
      setCheckingAdmin(false);
      return () => { active = false; };
    }

    setCheckingAdmin(true);
    supabase.from('admin_users')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setCheckingAdmin(false);
        if (error) {
          Alert.alert('Permisos de administración', error.message);
          return;
        }
        setIsAdmin(Boolean(data));
      })
      .catch((error) => {
        if (active) {
          setCheckingAdmin(false);
          Alert.alert('Error de conexión', String(error));
        }
      });

    return () => { active = false; };
  }, [session?.user.id]);

  const loadAdmin = useCallback(async (includeHistory: boolean) => {
    if (!session || !isAdmin) return;
    setLoadingAdmin(true);
    try {
      let query = supabase.from('appointments')
        .select('id, service, customer_name, customer_phone, appointment_date, appointment_time')
        .order('appointment_date', { ascending: !includeHistory })
        .order('appointment_time', { ascending: !includeHistory })
        .limit(300);

      if (!includeHistory) {
        query = query.gte('appointment_date', dateKey(new Date()));
      }
      const { data, error } = await query;
      if (error) Alert.alert('Error al cargar las citas', error.message);
      else setAdminAppointments((data ?? []) as Appointment[]);
    } catch (error) {
      Alert.alert('Error de conexión', String(error));
    } finally {
      setLoadingAdmin(false);
    }
  }, [session?.user.id, isAdmin]);

  const loadMine = useCallback(async () => {
    if (!session) return;
    setLoadingMine(true);
    const { data, error } = await supabase.from('appointments')
      .select('id, service, customer_name, customer_phone, appointment_date, appointment_time')
      .eq('user_id', session.user.id)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });
    setLoadingMine(false);
    if (error) Alert.alert('Error al leer citas', error.message);
    else setMyAppointments((data ?? []) as Appointment[]);
  }, [session]);

  useEffect(() => {
    if (session) void loadMine();
    else setMyAppointments([]);
  }, [session, loadMine]);

  async function authenticate() {
    if (!email.includes('@') || password.length < 6) {
      Alert.alert('Datos incorrectos', 'Introduce un correo y una contraseña de 6 caracteres como mínimo.');
      return;
    }
    setAuthBusy(true);
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = register
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

      if (error) {
        Alert.alert('Error de acceso', error.message);
        return;
      }

      if (data.session) {
        // Con "Confirm email" desactivado en Supabase, el registro
        // devuelve una sesión activa y se muestra el calendario.
        setSession(data.session);
        setPassword('');
        if (register) {
          setRegister(false);
          Alert.alert('¡Cuenta creada!', 'Ya puedes reservar una cita.');
        }
      } else if (register) {
        // No podemos eliminar la comprobación solo desde la app:
        // si Supabase requiere confirmación, no entrega una sesión.
        Alert.alert(
          'Configuración pendiente',
          'En Supabase, entra en Authentication > Providers > Email y desactiva Confirm email. Después, prueba con una cuenta nueva.'
        );
      }
    } catch (e) {
      Alert.alert('Error de conexión', String(e));
    } finally {
      setAuthBusy(false);
    }
  }

  async function confirmBooking() {
    if (!session || !date || !hour || saving) {
      Alert.alert('Faltan datos', 'Selecciona una fecha y una hora.');
      return;
    }
    if (customerName.trim().length < 2 || !/^[+0-9() .-]{7,20}$/.test(customerPhone.trim())) {
      Alert.alert('Revisa tus datos', 'Introduce tu nombre y un teléfono válido.');
      return;
    }
    if (booked.includes(hour) || inPast(date, hour)) {
      Alert.alert('No disponible', 'Esa hora ya está ocupada o ha pasado.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('appointments').insert({
        user_id: session.user.id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        service,
        appointment_date: date,
        appointment_time: `${hour}:00`,
      });
      if (error) {
        Alert.alert('No se pudo guardar', error.code === '23505'
          ? 'Otra persona acaba de reservar esa hora. Escoge una distinta.'
          : error.message);
        setRefreshHours((n) => n + 1);
        return;
      }
      Alert.alert('¡Cita guardada!', `${service}\n${formatDate(date)} a las ${hour}`);
      setHour(null);
      setRefreshHours((n) => n + 1);
      await loadMine();
      setTab('mine');
    } catch (e) {
      Alert.alert('Error de red', String(e));
    } finally {
      setSaving(false);
    }
  }

  function cancelBooking(id: number) {
    Alert.alert('Cancelar cita', '¿Quieres cancelar esta reserva?', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
        const { data, error } = await supabase.from('appointments')
          .delete().eq('id', id).select('id');
        if (error) Alert.alert('Error al cancelar', error.message);
        else if (!data?.length) Alert.alert('No se ha cancelado', 'La cita no existe o no tienes permisos.');
        else {
          setRefreshHours((n) => n + 1);
          await loadMine();
          if (isAdmin) await loadAdmin(showAdminHistory);
          Alert.alert('Cita cancelada', 'El horario vuelve a estar disponible.');
        }
      } },
    ]);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const firstDay = (currentMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  function changeMonth(value: number) {
    setMonthOffset((n) => n + value);
    setDate(null);
    setHour(null);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>✂ PeluCitas</Text>
        <Text style={styles.subtitle}>Reserva tu próxima cita de peluquería</Text>

        {loadingAuth ? (
          <ActivityIndicator color="#34D399" size="large" />
        ) : !session ? (
          <View style={styles.panel}>
            <Text style={styles.title}>{register ? 'Crear una cuenta' : 'Iniciar sesión'}</Text>
            <Text style={styles.help}>Para que tus citas queden guardadas, primero accede con tu correo.</Text>
            <TextInput style={styles.input} placeholder="Correo electrónico" placeholderTextColor="#9CA3AF"
              autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#9CA3AF"
              secureTextEntry value={password} onChangeText={setPassword} />
            <Pressable disabled={authBusy} style={styles.primaryButton} onPress={() => void authenticate()}>
              <Text style={styles.primaryText}>{authBusy ? 'Conectando...' : register ? 'Registrarme' : 'Entrar'}</Text>
            </Pressable>
            <Pressable onPress={() => setRegister((n) => !n)} style={styles.linkButton}>
              <Text style={styles.linkText}>{register ? 'Ya tengo cuenta' : 'No tengo cuenta: registrarme'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.accountBar}>
              <Text style={styles.accountEmail} numberOfLines={1}>{session.user.email}</Text>
              <Pressable onPress={() => void supabase.auth.signOut()}><Text style={styles.linkText}>Salir</Text></Pressable>
            </View>
            <View style={styles.tabBar}>
              <Pressable onPress={() => setTab('calendar')} style={[styles.tab, tab === 'calendar' && styles.tabActive]}>
                <Text style={styles.text}>Reservar</Text>
              </Pressable>
              <Pressable onPress={() => { setTab('mine'); void loadMine(); }} style={[styles.tab, tab === 'mine' && styles.tabActive]}>
                <Text style={styles.text}>Mis citas</Text>
              </Pressable>
              {isAdmin && (
                <Pressable onPress={() => { setTab('admin'); void loadAdmin(showAdminHistory); }}
                  style={[styles.tab, tab === 'admin' && styles.tabActive]}>
                  <Text style={styles.text}>Admin</Text>
                </Pressable>
              )}
            </View>
            {checkingAdmin && <Text style={styles.help}>Comprobando permisos de la cuenta...</Text>}
            {tab === 'calendar' ? (
              <>
                <Text style={styles.title}>1. Selecciona un servicio</Text>
                {SERVICES.map((item) => (
                  <Pressable key={item.name} onPress={() => setService(item.name)}
                    style={[styles.serviceRow, service === item.name && styles.selected]}>
                    <Text style={styles.text}>{item.name}</Text>
                    <Text style={styles.price}>{item.price}</Text>
                  </Pressable>
                ))}

                <Text style={styles.title}>2. Selecciona el día</Text>
                <View style={styles.calendar}>
                  <View style={styles.monthHeader}>
                    <Pressable disabled={monthOffset === 0} onPress={() => changeMonth(-1)}>
                      <Text style={styles.arrow}>{monthOffset === 0 ? ' ' : '‹'}</Text>
                    </Pressable>
                    <Text style={styles.monthTitle}>{currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</Text>
                    <Pressable disabled={monthOffset >= 5} onPress={() => changeMonth(1)}>
                      <Text style={styles.arrow}>{monthOffset >= 5 ? ' ' : '›'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.grid}>
                    {WEEKDAYS.map((d) => <View key={d} style={styles.dayCell}><Text style={styles.weekday}>{d}</Text></View>)}
                    {Array.from({ length: firstDay }, (_, i) => <View key={`empty-${i}`} style={styles.dayCell} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const number = i + 1;
                      const thisDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), number);
                      const key = dateKey(thisDay);
                      const available = thisDay >= today && thisDay.getDay() !== 0;
                      const active = date === key;
                      return (
                        <View key={key} style={styles.dayCell}>
                          <Pressable disabled={!available} onPress={() => { setDate(key); setHour(null); }}
                            style={[styles.dayButton, active && styles.daySelected]}>
                            <Text style={[styles.dayNumber, !available && styles.dayDisabled, active && styles.activeNumber]}>{number}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <Text style={styles.title}>3. Selecciona una hora</Text>
                {!date ? (
                  <Text style={styles.help}>Selecciona primero una fecha.</Text>
                ) : loadingHours ? (
                  <ActivityIndicator color="#34D399" />
                ) : (
                  <View style={styles.hourGrid}>
                    {HOURS.map((item) => {
                      const occupied = booked.includes(item) || inPast(date, item);
                      return (
                        <Pressable key={item} disabled={occupied} onPress={() => setHour(item)}
                          style={[styles.hourButton, occupied && styles.hourDisabled, hour === item && styles.selected]}>
                          <Text style={[styles.text, occupied && styles.dim]}>{item}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Text style={styles.help}>Las horas apagadas ya están reservadas o han pasado.</Text>
                <Text style={styles.title}>4. Tus datos</Text>
                <TextInput style={styles.input} placeholder="Nombre y apellidos" placeholderTextColor="#9CA3AF"
                  value={customerName} onChangeText={setCustomerName} maxLength={80} />
                <TextInput style={styles.input} placeholder="Teléfono de contacto" placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} maxLength={20} />
                <Pressable disabled={!date || !hour || saving || loadingHours} style={[styles.primaryButton, (!date || !hour || saving || loadingHours) && styles.disabledButton]} onPress={() => void confirmBooking()}>
                  <Text style={styles.primaryText}>{saving ? 'Guardando...' : 'Confirmar cita'}</Text>
                </Pressable>
              </>
            ) : tab === 'mine' ? (
              <View style={styles.panel}>
                <Text style={styles.title}>Mis citas guardadas</Text>
                {loadingMine && <ActivityIndicator color="#34D399" />}
                {!loadingMine && myAppointments.length === 0 && <Text style={styles.help}>Todavía no tienes reservas.</Text>}
                {myAppointments.map((item) => {
                  const isPast = inPast(item.appointment_date, item.appointment_time.slice(0, 5));
                  return (
                    <View key={item.id} style={styles.reservation}>
                      <Text style={styles.text}>{item.service}</Text>
                      <Text style={styles.price}>{formatDate(item.appointment_date)} · {item.appointment_time.slice(0, 5)}</Text>
                      <Text style={styles.help}>{item.customer_name} · {item.customer_phone}</Text>
                      {!isPast && <Pressable onPress={() => cancelBooking(item.id)}><Text style={styles.cancel}>Cancelar cita</Text></Pressable>}
                    </View>
                  );
                })}
              </View>
            ) : isAdmin ? (
              <View style={styles.panel}>
                <Text style={styles.title}>Panel del peluquero</Text>
                <Text style={styles.help}>
                  Consulta las citas de todos los clientes y cancela reservas si es necesario.
                </Text>
                <View style={styles.adminActions}>
                  <Pressable style={styles.smallAction} onPress={() => void loadAdmin(showAdminHistory)}>
                    <Text style={styles.linkText}>Actualizar</Text>
                  </Pressable>
                  <Pressable style={styles.smallAction} onPress={() => {
                    const next = !showAdminHistory;
                    setShowAdminHistory(next);
                    void loadAdmin(next);
                  }}>
                    <Text style={styles.linkText}>
                      {showAdminHistory ? 'Ver próximas' : 'Ver historial'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.summary}>
                  {showAdminHistory ? 'Últimas citas' : 'Citas desde hoy'}: {adminAppointments.length}
                </Text>
                {loadingAdmin && <ActivityIndicator color="#34D399" />}
                {!loadingAdmin && adminAppointments.length === 0 && (
                  <Text style={styles.help}>No hay citas para mostrar.</Text>
                )}
                {adminAppointments.map((item) => {
                  const isPast = inPast(item.appointment_date, item.appointment_time.slice(0, 5));
                  return (
                    <View key={item.id} style={styles.reservation}>
                      <Text style={styles.text}>{item.customer_name}</Text>
                      <Text style={styles.price}>
                        {formatDate(item.appointment_date)} · {item.appointment_time.slice(0, 5)}
                      </Text>
                      <Text style={styles.help}>{item.service}</Text>
                      <Text style={styles.help}>Teléfono: {item.customer_phone}</Text>
                      {!isPast && (
                        <Pressable onPress={() => cancelBooking(item.id)}>
                          <Text style={styles.cancel}>Cancelar esta cita</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                <Text style={styles.help}>Se muestran hasta 300 citas por consulta.</Text>
              </View>
            ) : null}
          </>
        )}
        <Text style={styles.footer}>PeluCitas · Una peluquería · Duración por cita: 60 minutos</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101827' },
  content: { padding: 22, paddingTop: 55, paddingBottom: 65 },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: '#9CA3AF', marginTop: 7, marginBottom: 15 },
  title: { color: '#fff', fontSize: 19, fontWeight: 'bold', marginTop: 23, marginBottom: 13 },
  panel: { backgroundColor: '#1F2937', padding: 16, borderRadius: 16, marginTop: 15 },
  help: { color: '#9CA3AF', lineHeight: 19, marginTop: 8 },
  text: { color: '#fff', fontWeight: '600' },
  price: { color: '#34D399', fontWeight: '700' },
  input: { backgroundColor: '#1F2937', borderColor: '#374151', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 14, color: '#fff', marginTop: 10 },
  primaryButton: { backgroundColor: '#34D399', padding: 18, alignItems: 'center', borderRadius: 13, marginTop: 22 },
  disabledButton: { opacity: 0.4 },
  primaryText: { color: '#101827', fontWeight: 'bold', fontSize: 16 },
  linkButton: { marginTop: 17, alignItems: 'center' },
  linkText: { color: '#34D399', fontWeight: '700' },
  accountBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  accountEmail: { color: '#fff', flex: 1, marginRight: 10 },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 7 },
  tab: { flex: 1, padding: 13, backgroundColor: '#1F2937', alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#254737', borderWidth: 1, borderColor: '#34D399' },
  serviceRow: { backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  selected: { borderColor: '#34D399', backgroundColor: '#254737', borderWidth: 1 },
  calendar: { padding: 12, backgroundColor: '#1F2937', borderRadius: 17 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  arrow: { color: '#34D399', fontSize: 32, paddingHorizontal: 12 },
  monthTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 44, justifyContent: 'center', alignItems: 'center' },
  weekday: { color: '#9CA3AF', fontWeight: 'bold' },
  dayButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: '#34D399' },
  dayNumber: { color: '#fff', fontSize: 15 },
  dayDisabled: { color: '#4B5563' },
  activeNumber: { color: '#101827', fontWeight: 'bold' },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hourButton: { backgroundColor: '#1F2937', borderColor: '#374151', borderWidth: 1, borderRadius: 10, paddingHorizontal: 17, paddingVertical: 14 },
  hourDisabled: { opacity: 0.35 },
  dim: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  reservation: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#374151', gap: 6 },
  cancel: { color: '#FCA5A5', fontWeight: '700', marginTop: 8 },
  adminActions: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 12 },
  smallAction: { borderWidth: 1, borderColor: '#34D399', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 13 },
  summary: { color: '#fff', fontWeight: 'bold', marginBottom: 12 },
  footer: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 25 },
});
