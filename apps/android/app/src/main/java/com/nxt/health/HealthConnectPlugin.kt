package com.nxt.health

import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PluginMethod
import java.time.Instant
import java.time.ZoneId
import kotlin.reflect.KClass
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var pendingPermissionCall: PluginCall? = null
    private var pendingPermissionNames: Set<String> = emptySet()
    private lateinit var permissionLauncher: ActivityResultLauncher<Set<String>>

    private val dataTypeClasses: Map<String, KClass<out Record>> = linkedMapOf(
        "steps" to StepsRecord::class,
        "exercise" to ExerciseSessionRecord::class,
        "distance" to DistanceRecord::class,
        "activeCalories" to ActiveCaloriesBurnedRecord::class,
        "weight" to WeightRecord::class,
        "bodyFat" to BodyFatRecord::class,
        "heartRate" to HeartRateRecord::class,
        "restingHeartRate" to RestingHeartRateRecord::class,
        "sleep" to SleepSessionRecord::class,
    )

    override fun load() {
        permissionLauncher = bridge.registerForActivityResult(
            PermissionController.createRequestPermissionResultContract(),
        ) { granted ->
            val call = pendingPermissionCall ?: return@registerForActivityResult
            val requested = pendingPermissionNames
            pendingPermissionCall = null
            pendingPermissionNames = emptySet()
            val result = JSObject()
            result.put("granted", JSArray(granted.toList()))
            result.put("requested", JSArray(requested.toList()))
            result.put("missing", JSArray(requested.filterNot(granted::contains)))
            call.resolve(result)
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val result = JSObject()
        result.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        result.put("status", availabilityLabel(status))
        result.put("sdkStatus", status)
        result.put("providerPackage", "com.google.android.apps.healthdata")
        call.resolve(result)
    }

    @PluginMethod
    fun getPermissions(call: PluginCall) {
        withClient(call) { client ->
            val granted = client.permissionController.getGrantedPermissions()
            val result = JSObject()
            result.put("permissions", JSArray(granted.toList()))
            result.put("dataTypes", JSArray(dataTypeClasses.filterValues {
                granted.contains(HealthPermission.getReadPermission(it))
            }.keys.toList()))
            call.resolve(result)
        }
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val requestedTypes = dataTypesFrom(call)
        if (requestedTypes.isEmpty()) {
            call.reject("At least one Health Connect data type is required.", "invalid_data_types")
            return
        }
        val status = HealthConnectClient.getSdkStatus(context)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is ${availabilityLabel(status)}.", availabilityLabel(status))
            return
        }
        val permissions = requestedTypes.map(HealthPermission::getReadPermission).toSet()
        pendingPermissionCall = call
        pendingPermissionNames = permissions
        permissionLauncher.launch(permissions)
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = HealthConnectClient.getHealthConnectManageDataIntent(context)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun read(call: PluginCall) {
        val requestedTypes = dataTypesFrom(call)
        if (requestedTypes.isEmpty()) {
            call.reject("At least one Health Connect data type is required.", "invalid_data_types")
            return
        }
        val startTime = parseInstant(call, call.getString("startTime"), "startTime") ?: return
        val endTime = parseInstant(call, call.getString("endTime"), "endTime") ?: return
        if (!startTime.isBefore(endTime)) {
            call.reject("startTime must be before endTime.", "invalid_time_range")
            return
        }

        withClient(call) { client ->
            val required = requestedTypes.map(HealthPermission::getReadPermission).toSet()
            val granted = client.permissionController.getGrantedPermissions()
            val missing = required.filterNot(granted::contains)
            if (missing.isNotEmpty()) {
                val data = JSObject()
                data.put("missing", JSArray(missing))
                call.reject("Health Connect permissions are missing.", "permission_required", data)
                return@withClient
            }

            val range = TimeRangeFilter.between(startTime, endTime)
            val records = requestedTypes.flatMap { readRecords(client, it, range) }
            val result = JSObject()
            result.put("records", JSArray(records.map(::recordToJson)))
            result.put("dataTypes", JSArray(requestedTypes.map(::dataTypeName)))
            result.put("startTime", startTime.toString())
            result.put("endTime", endTime.toString())
            call.resolve(result)
        }
    }

    private fun dataTypesFrom(call: PluginCall): List<KClass<out Record>> {
        val input = call.getArray("dataTypes") ?: return dataTypeClasses.values.toList()
        val names = (0 until input.length()).mapNotNull { index ->
            input.optString(index).takeIf { it.isNotBlank() }
        }
        return names.distinct().mapNotNull(dataTypeClasses::get)
    }

    private fun dataTypeName(type: KClass<out Record>): String =
        dataTypeClasses.entries.first { it.value == type }.key

    private fun readRecords(
        client: HealthConnectClient,
        type: KClass<out Record>,
        range: TimeRangeFilter,
    ): List<Record> = when (type) {
        StepsRecord::class -> client.readRecords(ReadRecordsRequest(StepsRecord::class, range)).records
        ExerciseSessionRecord::class -> client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, range)).records
        DistanceRecord::class -> client.readRecords(ReadRecordsRequest(DistanceRecord::class, range)).records
        ActiveCaloriesBurnedRecord::class -> client.readRecords(ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, range)).records
        WeightRecord::class -> client.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records
        BodyFatRecord::class -> client.readRecords(ReadRecordsRequest(BodyFatRecord::class, range)).records
        HeartRateRecord::class -> client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range)).records
        RestingHeartRateRecord::class -> client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, range)).records
        SleepSessionRecord::class -> client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range)).records
        else -> emptyList()
    }

    private fun recordToJson(record: Record): JSObject {
        val metadata = record.metadata
        val result = JSObject()
        result.put("recordType", dataTypeName(record::class))
        result.put("recordId", metadata.id)
        result.put("clientRecordId", metadata.clientRecordId)
        result.put("clientRecordVersion", metadata.clientRecordVersion)
        result.put("sourceApp", metadata.dataOrigin.packageName)
        result.put("deviceName", metadata.device?.model)
        result.put("lastModifiedTime", metadata.lastModifiedTime.toString())

        when (record) {
            is StepsRecord -> interval(result, record.startTime, record.endTime, "steps", record.count.toDouble(), "steps")
            is ExerciseSessionRecord -> interval(result, record.startTime, record.endTime, "exercise", null, "text").apply {
                put("exerciseType", record.exerciseType)
                put("title", record.title)
            }
            is DistanceRecord -> interval(result, record.startTime, record.endTime, "distance", record.distance.inMeters, "meters")
            is ActiveCaloriesBurnedRecord -> interval(result, record.startTime, record.endTime, "activeCalories", record.energy.inKilocalories, "kcal")
            is WeightRecord -> instant(result, record.time, "weight", record.weight.inKilograms, "kilograms")
            is BodyFatRecord -> instant(result, record.time, "bodyFat", record.percentage.value.toDouble(), "percent")
            is HeartRateRecord -> {
                val samples = JSArray()
                record.samples.forEach { sample ->
                    samples.put(JSObject().apply {
                        put("time", sample.time.toString())
                        put("bpm", sample.beatsPerMinute)
                    })
                }
                interval(result, record.startTime, record.endTime, "heartRate", null, "bpm")
                result.put("samples", samples)
            }
            is RestingHeartRateRecord -> instant(result, record.time, "restingHeartRate", record.beatsPerMinute.toDouble(), "bpm")
            is SleepSessionRecord -> interval(result, record.startTime, record.endTime, "sleep", null, "hours").apply {
                put("title", record.title)
                put("notes", record.notes)
                val stages = JSArray()
                record.stages.forEach { stage ->
                    stages.put(JSObject().apply {
                        put("startTime", stage.startTime.toString())
                        put("endTime", stage.endTime.toString())
                        put("stage", stage.stage)
                    })
                }
                put("stages", stages)
            }
        }
        return result
    }

    private fun interval(
        result: JSObject,
        start: Instant,
        end: Instant,
        metric: String,
        value: Double?,
        unit: String,
    ): JSObject {
        result.put("metric", metric)
        result.put("startTime", start.toString())
        result.put("endTime", end.toString())
        result.put("localDate", start.atZone(ZoneId.systemDefault()).toLocalDate().toString())
        result.put("unit", unit)
        if (value != null) result.put("value", value)
        return result
    }

    private fun instant(
        result: JSObject,
        time: Instant,
        metric: String,
        value: Double,
        unit: String,
    ): JSObject = interval(result, time, time, metric, value, unit)

    private fun <T> withClient(call: PluginCall, block: suspend (HealthConnectClient) -> T) {
        val status = HealthConnectClient.getSdkStatus(context)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is ${availabilityLabel(status)}.", availabilityLabel(status))
            return
        }
        scope.launch {
            try {
                block(HealthConnectClient.getOrCreate(context))
            } catch (error: SecurityException) {
                call.reject("Health Connect permission was denied.", "permission_denied", error)
            } catch (error: Exception) {
                call.reject(error.message ?: "Health Connect request failed.", "health_connect_error", error)
            }
        }
    }

    private fun parseInstant(call: PluginCall, value: String?, name: String): Instant? = try {
        Instant.parse(value ?: throw IllegalArgumentException("Missing $name."))
    } catch (error: Exception) {
        call.reject("$name must be an ISO-8601 timestamp.", "invalid_timestamp", error)
        null
    }

    private fun availabilityLabel(status: Int): String = when (status) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "provider-update-required"
        else -> "unavailable"
    }
}
