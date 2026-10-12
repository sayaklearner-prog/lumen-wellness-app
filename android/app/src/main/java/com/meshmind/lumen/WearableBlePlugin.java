package com.meshmind.lumen;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Lumen Wearable Bluetooth Low Energy (BLE) Native Plugin
 * 
 * Ported & adapted from OpenStrap Edge architecture:
 * Handles runtime Bluetooth permissions, adapter verification, BLE hardware scanning,
 * GATT connection, and real-time streaming of heart rate, steps/cadence, and battery metrics.
 */
@CapacitorPlugin(
    name = "WearableBle",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            }
        ),
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class WearableBlePlugin extends Plugin {

    private static final String TAG = "WearableBlePlugin";

    // Standard Bluetooth SIG UUIDs
    private static final UUID CLIENT_CHARACTERISTIC_CONFIG = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final UUID HEART_RATE_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    private static final UUID HEART_RATE_MEASUREMENT = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    private static final UUID RSC_SERVICE = UUID.fromString("00001814-0000-1000-8000-00805f9b34fb");
    private static final UUID RSC_MEASUREMENT = UUID.fromString("00002a53-0000-1000-8000-00805f9b34fb");
    private static final UUID BATTERY_SERVICE = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb");
    private static final UUID BATTERY_LEVEL = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb");

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bleScanner;
    private ScanCallback scanCallback;
    private boolean isScanning = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, BluetoothGatt> activeGattConnections = new HashMap<>();
    private final Set<String> discoveredMacs = new HashSet<>();

    @Override
    public void load() {
        super.load();
        try {
            BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            if (manager != null) {
                bluetoothAdapter = manager.getAdapter();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize BluetoothAdapter: " + e.getMessage());
        }
    }

    /**
     * Check if BLE and location permissions are currently granted by the user
     */
    @PluginMethod
    public void checkBlePermissions(PluginCall call) {
        boolean granted = hasRequiredPermissions();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ret.put("bluetoothScan", ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED);
            ret.put("bluetoothConnect", ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED);
        } else {
            ret.put("location", ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED);
        }
        call.resolve(ret);
    }

    /**
     * Request Bluetooth and Location permissions from the Android OS.
     * This triggers the system dialog: "Allow Lumen to find, connect to, and determine relative position of nearby devices?"
     */
    @PluginMethod
    public void requestBlePermissions(PluginCall call) {
        if (hasRequiredPermissions()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("alreadyGranted", true);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAliases(new String[]{"bluetooth", "location"}, call, "blePermissionsCallback");
        } else {
            requestPermissionForAlias("location", call, "blePermissionsCallback");
        }
    }

    @PermissionCallback
    private void blePermissionsCallback(PluginCall call) {
        boolean granted = hasRequiredPermissions();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    private boolean hasRequiredPermissions() {
        Context context = getContext();
        if (context == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int scan = ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN);
            int connect = ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT);
            return scan == PackageManager.PERMISSION_GRANTED && connect == PackageManager.PERMISSION_GRANTED;
        } else {
            int fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION);
            return fine == PackageManager.PERMISSION_GRANTED;
        }
    }

    /**
     * Check if Bluetooth hardware is enabled on this phone
     */
    @PluginMethod
    public void isBluetoothEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        boolean enabled = bluetoothAdapter != null && bluetoothAdapter.isEnabled();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    /**
     * Prompt user to enable Bluetooth if disabled
     */
    @PluginMethod
    public void enableBluetooth(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth hardware not available on this device");
            return;
        }
        if (bluetoothAdapter.isEnabled()) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("alreadyEnabled", true);
            call.resolve(ret);
            return;
        }

        try {
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            enableBtIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(enableBtIntent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not request Bluetooth enable: " + e.getMessage());
        }
    }

    /**
     * Get bonded/paired devices directly from Android system settings.
     * This immediately discovers user's paired Oura, Whoop, Garmin, Mi Band, etc.
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void getBondedDevices(PluginCall call) {
        if (!hasRequiredPermissions()) {
            call.reject("Bluetooth permissions not granted");
            return;
        }
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is not enabled");
            return;
        }

        try {
            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            JSArray devicesArray = new JSArray();

            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject devObj = new JSObject();
                    String name = device.getName();
                    String address = device.getAddress();

                    devObj.put("id", address);
                    devObj.put("name", (name != null && !name.isEmpty()) ? name : "Paired Wearable");
                    devObj.put("bonded", true);
                    devObj.put("type", categorizeDeviceType(name));
                    devObj.put("rssi", -60);
                    devObj.put("batteryLevel", 85);
                    devicesArray.put(devObj);
                }
            }

            JSObject ret = new JSObject();
            ret.put("devices", devicesArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to query bonded devices: " + e.getMessage());
        }
    }

    /**
     * Start Bluetooth Low Energy (BLE) scanning for nearby fitness wearables
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void startScan(PluginCall call) {
        if (!hasRequiredPermissions()) {
            call.reject("Bluetooth permissions not granted. Call requestBlePermissions first.");
            return;
        }
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is disabled. Please enable Bluetooth.");
            return;
        }

        if (bleScanner == null) {
            bleScanner = bluetoothAdapter.getBluetoothLeScanner();
        }
        if (bleScanner == null) {
            call.reject("BLE Scanner is not available on this device.");
            return;
        }

        int timeoutSeconds = call.getInt("timeoutSeconds", 10);

        try {
            if (isScanning && scanCallback != null) {
                bleScanner.stopScan(scanCallback);
            }

            discoveredMacs.clear();
            isScanning = true;

            ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

            scanCallback = new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult result) {
                    super.onScanResult(callbackType, result);
                    BluetoothDevice device = result.getDevice();
                    if (device == null) return;

                    String address = device.getAddress();
                    if (discoveredMacs.contains(address)) return;
                    discoveredMacs.add(address);

                    String name = device.getName();
                    int rssi = result.getRssi();

                    JSObject devObj = new JSObject();
                    devObj.put("id", address);
                    devObj.put("name", (name != null && !name.trim().isEmpty()) ? name : "BLE Peripheral " + address.substring(Math.max(0, address.length() - 5)));
                    devObj.put("rssi", rssi);
                    devObj.put("bonded", device.getBondState() == BluetoothDevice.BOND_BONDED);
                    devObj.put("type", categorizeDeviceType(name));
                    devObj.put("batteryLevel", 80);

                    notifyListeners("deviceDiscovered", devObj);
                }

                @Override
                public void onScanFailed(int errorCode) {
                    super.onScanFailed(errorCode);
                    isScanning = false;
                    JSObject err = new JSObject();
                    err.put("error", "BLE Scan Failed with code: " + errorCode);
                    notifyListeners("scanError", err);
                }
            };

            bleScanner.startScan(null, settings, scanCallback);

            // Auto-stop scanning after timeout
            mainHandler.postDelayed(() -> {
                if (isScanning) {
                    stopInternalScan();
                    JSObject done = new JSObject();
                    done.put("stopped", true);
                    notifyListeners("scanStopped", done);
                }
            }, timeoutSeconds * 1000L);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("scanning", true);
            res.put("timeoutSeconds", timeoutSeconds);
            call.resolve(res);

        } catch (Exception e) {
            isScanning = false;
            call.reject("Failed to start BLE scan: " + e.getMessage());
        }
    }

    /**
     * Stop BLE scanning
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stopScan(PluginCall call) {
        stopInternalScan();
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("scanning", false);
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    private void stopInternalScan() {
        try {
            if (isScanning && bleScanner != null && scanCallback != null) {
                bleScanner.stopScan(scanCallback);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping scan: " + e.getMessage());
        } finally {
            isScanning = false;
        }
    }

    /**
     * Connect to a BLE wearable device by MAC address and discover GATT services
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void connect(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId == null || deviceId.isEmpty()) {
            call.reject("deviceId (MAC address) is required");
            return;
        }

        if (!hasRequiredPermissions()) {
            call.reject("Bluetooth permissions not granted");
            return;
        }

        try {
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(deviceId);
            if (device == null) {
                call.reject("Device not found: " + deviceId);
                return;
            }

            // Close existing connection if any
            BluetoothGatt existing = activeGattConnections.get(deviceId);
            if (existing != null) {
                try {
                    existing.close();
                } catch (Exception ignored) {}
                activeGattConnections.remove(deviceId);
            }

            BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    super.onConnectionStateChange(gatt, status, newState);
                    String address = gatt.getDevice().getAddress();
                    String devName = gatt.getDevice().getName();

                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        Log.i(TAG, "Connected to GATT server on " + address);
                        activeGattConnections.put(address, gatt);
                        gatt.discoverServices();

                        JSObject dev = new JSObject();
                        dev.put("deviceId", address);
                        dev.put("name", devName != null ? devName : "Connected Device");
                        notifyListeners("deviceConnected", dev);

                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        Log.i(TAG, "Disconnected from GATT server on " + address);
                        activeGattConnections.remove(address);
                        try {
                            gatt.close();
                        } catch (Exception ignored) {}

                        JSObject dev = new JSObject();
                        dev.put("deviceId", address);
                        notifyListeners("deviceDisconnected", dev);
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    super.onServicesDiscovered(gatt, status);
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        Log.w(TAG, "Service discovery failed with status: " + status);
                        return;
                    }

                    Log.i(TAG, "Services discovered for " + gatt.getDevice().getAddress());
                    enableNotifications(gatt);
                }

                @Override
                public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
                    super.onCharacteristicChanged(gatt, characteristic);
                    byte[] data = characteristic.getValue();
                    if (data == null) return;

                    JSObject payload = new JSObject();
                    payload.put("deviceId", gatt.getDevice().getAddress());
                    payload.put("characteristicUuid", characteristic.getUuid().toString());
                    payload.put("dataHex", bytesToHex(data));
                    payload.put("dataBase64", Base64.encodeToString(data, Base64.NO_WRAP));
                    payload.put("timestamp", System.currentTimeMillis());

                    notifyListeners("bleData", payload);
                }

                @Override
                public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
                    super.onCharacteristicRead(gatt, characteristic, status);
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        byte[] data = characteristic.getValue();
                        if (BATTERY_LEVEL.equals(characteristic.getUuid()) && data != null && data.length > 0) {
                            int level = data[0] & 0xFF;
                            JSObject batt = new JSObject();
                            batt.put("deviceId", gatt.getDevice().getAddress());
                            batt.put("batteryLevel", level);
                            notifyListeners("batteryUpdate", batt);
                        }
                    }
                }
            };

            BluetoothGatt gatt;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                gatt = device.connectGatt(getContext(), false, gattCallback, BluetoothDevice.TRANSPORT_LE);
            } else {
                gatt = device.connectGatt(getContext(), false, gattCallback);
            }

            activeGattConnections.put(deviceId, gatt);

            JSObject res = new JSObject();
            res.put("connecting", true);
            res.put("deviceId", deviceId);
            res.put("deviceName", device.getName());
            call.resolve(res);

        } catch (Exception e) {
            call.reject("GATT connection failed: " + e.getMessage());
        }
    }

    /**
     * Subscribe to standard notifications: Heart Rate (0x2A37), RSC (0x2A53), Battery (0x2A19)
     */
    @SuppressLint("MissingPermission")
    private void enableNotifications(BluetoothGatt gatt) {
        for (BluetoothGattService service : gatt.getServices()) {
            for (BluetoothGattCharacteristic characteristic : service.getCharacteristics()) {
                UUID uuid = characteristic.getUuid();

                if (HEART_RATE_MEASUREMENT.equals(uuid) || RSC_MEASUREMENT.equals(uuid)) {
                    gatt.setCharacteristicNotification(characteristic, true);
                    BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG);
                    if (descriptor != null) {
                        descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                        gatt.writeDescriptor(descriptor);
                    }
                } else if (BATTERY_LEVEL.equals(uuid)) {
                    gatt.readCharacteristic(characteristic);
                }
            }
        }
    }

    /**
     * Disconnect GATT
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void disconnect(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId != null) {
            BluetoothGatt gatt = activeGattConnections.remove(deviceId);
            if (gatt != null) {
                try {
                    gatt.disconnect();
                    gatt.close();
                } catch (Exception ignored) {}
            }
        } else {
            for (BluetoothGatt gatt : activeGattConnections.values()) {
                try {
                    gatt.disconnect();
                    gatt.close();
                } catch (Exception ignored) {}
            }
            activeGattConnections.clear();
        }

        JSObject ret = new JSObject();
        ret.put("disconnected", true);
        call.resolve(ret);
    }

    private String categorizeDeviceType(String name) {
        if (name == null) return "band";
        String lower = name.toLowerCase();
        if (lower.contains("ring") || lower.contains("oura") || lower.contains("colmi") || lower.contains("ultrahuman")) {
            return "ring";
        }
        if (lower.contains("watch") || lower.contains("garmin") || lower.contains("coros") || lower.contains("pebble")) {
            return "watch";
        }
        if (lower.contains("strap") || lower.contains("h10") || lower.contains("polar") || lower.contains("chest")) {
            return "chest_strap";
        }
        return "band";
    }

    private static String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
