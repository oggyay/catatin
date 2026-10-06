package com.example.catatin.util

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

object FormatUtils {
    private val idLocale = Locale("id", "ID")
    private val currencyFormat = NumberFormat.getCurrencyInstance(idLocale).apply {
        maximumFractionDigits = 0
        minimumFractionDigits = 0
    }

    fun formatIDR(value: Double): String {
        return currencyFormat.format(value)
    }

    fun formatNumber(value: Double): String {
        return NumberFormat.getNumberInstance(idLocale).apply {
            maximumFractionDigits = 0
        }.format(value)
    }

    fun formatDate(dateStr: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(dateStr) ?: return dateStr
            val formatter = SimpleDateFormat("dd MMM yyyy", idLocale)
            formatter.format(date)
        } catch (e: Exception) {
            try {
                val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                val date = parser.parse(dateStr) ?: return dateStr
                val formatter = SimpleDateFormat("dd MMM yyyy", idLocale)
                formatter.format(date)
            } catch (e2: Exception) {
                dateStr
            }
        }
    }

    fun formatDateTime(dateStr: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(dateStr) ?: return dateStr
            val formatter = SimpleDateFormat("dd MMM yyyy HH:mm", idLocale)
            formatter.format(date)
        } catch (e: Exception) {
            dateStr
        }
    }

    fun todayIsoDate(): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return formatter.format(java.util.Date())
    }

    fun formatInputNumber(value: String): String {
        val digits = value.replace(Regex("[^0-9]"), "")
        if (digits.isEmpty()) return ""
        val number = digits.toLongOrNull() ?: return ""
        return NumberFormat.getNumberInstance(idLocale).format(number)
    }

    fun parseInputNumber(formatted: String): Long {
        val digits = formatted.replace(Regex("[^0-9]"), "")
        return digits.toLongOrNull() ?: 0L
    }
}
