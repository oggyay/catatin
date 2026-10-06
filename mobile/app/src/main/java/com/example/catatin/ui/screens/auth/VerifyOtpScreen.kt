package com.example.catatin.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerifyOtpScreen(
    phone: String,
    onBack: () -> Unit,
    onVerificationSuccess: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: VerifyOtpViewModel = koinViewModel()
) {
    val code by viewModel.code.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(CatatinColors.DarkBg, CatatinColors.DarkBgEnd)
                )
            )
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Elegant Top Bar
            TopAppBar(
                title = { Text("", color = Color.White) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Kembali",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Title / Branding
                Text(
                    text = "Verifikasi Kode",
                    style = MaterialTheme.typography.headlineLarge,
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center
                )

                Text(
                    text = "Kami telah mengirimkan kode OTP ke nomor WhatsApp\n$phone",
                    style = MaterialTheme.typography.bodyMedium,
                    color = CatatinColors.TextMuted,
                    modifier = Modifier.padding(top = 8.dp, bottom = 32.dp),
                    textAlign = TextAlign.Center
                )

                // Card
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Masukkan OTP",
                            style = MaterialTheme.typography.headlineSmall,
                            color = CatatinColors.TextPrimary,
                            fontWeight = FontWeight.Bold
                        )

                        Text(
                            text = "Masukkan 6 digit kode keamanan Anda di bawah",
                            style = MaterialTheme.typography.bodySmall,
                            color = CatatinColors.TextSecondary,
                            modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
                            textAlign = TextAlign.Center
                        )

                        // Error State
                        if (uiState is VerifyOtpUiState.Error) {
                            Surface(
                                color = CatatinColors.DangerLight,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 16.dp)
                            ) {
                                Text(
                                    text = (uiState as VerifyOtpUiState.Error).message,
                                    color = CatatinColors.Danger,
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(12.dp),
                                    textAlign = TextAlign.Center
                                )
                            }
                        }

                        // OTP Outlined Field
                        OutlinedTextField(
                            value = code,
                            onValueChange = {
                                viewModel.clearError()
                                viewModel.updateCode(it)
                            },
                            label = { Text("Kode OTP") },
                            placeholder = { Text("123456") },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = "Lock icon",
                                    tint = CatatinColors.Primary
                                )
                            },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = CatatinColors.Primary,
                                unfocusedBorderColor = CatatinColors.Border
                            ),
                            enabled = uiState !is VerifyOtpUiState.Loading,
                            textStyle = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                letterSpacing = 8.sp
                            )
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        // Submit Button
                        Button(
                            onClick = {
                                viewModel.verifyOtp(phone) {
                                    onVerificationSuccess()
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = CatatinColors.Primary,
                                contentColor = Color.White
                            ),
                            enabled = uiState !is VerifyOtpUiState.Loading && code.length == 6
                        ) {
                            if (uiState is VerifyOtpUiState.Loading) {
                                CircularProgressIndicator(
                                    color = Color.White,
                                    modifier = Modifier.size(24.dp)
                                )
                            } else {
                                Text(
                                    text = "Verifikasi Sekarang",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
