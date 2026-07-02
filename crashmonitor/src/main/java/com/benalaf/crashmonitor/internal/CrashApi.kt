package com.benalaf.crashmonitor.internal

import com.benalaf.crashmonitor.model.CrashReport
import com.benalaf.crashmonitor.model.IngestResult
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

internal interface CrashApi {

    @POST("api/v1/crashes")
    fun uploadReports(
        @Header("X-API-Key") apiKey: String,
        @Body reports: List<CrashReport>,
    ): Call<List<IngestResult>>
}
