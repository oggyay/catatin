package com.example.catatin.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.catatin.theme.CatatinColors
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun LoginScreen(
    onNavigateToRegister: () -> Unit,
    onNavigateToVerifyOtp: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: LoginViewModel = koinViewModel()
) {
    val phone by viewModel.phone.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(CatatinColors.DarkBg, CatatinColors.DarkBgEnd)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Logo / Branding
            Text(
                text = "CatatIN",
                style = MaterialTheme.typography.displayLarge,
                color = Color.White,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center
            )
            
            Text(
                text = "Pencatatan Keuangan Praktis & WA Bot",
                style = MaterialTheme.typography.bodyMedium,
                color = CatatinColors.TextMuted,
                modifier = Modifier.padding(top = 8.dp, bottom = 32.dp),
                textAlign = TextAlign.Center
            )

            // Login Card
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
                        text = "Masuk Akun",
                        style = MaterialTheme.typography.headlineMedium,
                        color = CatatinColors.TextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Text(
                        text = "Masukkan nomor WhatsApp Anda untuk menerima kode OTP",
                        style = MaterialTheme.typography.bodySmall,
                        color = CatatinColors.TextSecondary,
                        modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
                        textAlign = TextAlign.Center
                    )

                    // Error message
                    if (uiState is LoginUiState.Error) {
                        Surface(
                            color = CatatinColors.DangerLight,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                        ) {
                            Text(
                                text = (uiState as LoginUiState.Error).message,
                                color = CatatinColors.Danger,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(12.dp),
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    // Input Phone Number
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { 
                            viewModel.clearError()
                            viewModel.updatePhone(it) 
                        },
                        label = { Text("Nomor WhatsApp") },
                        placeholder = { Text("Contoh: 081234567890") },
                        leadingIcon = { 
                            Icon(
                                imageVector = Icons.Default.Phone, 
                                contentDescription = "Phone icon",
                                tint = CatatinColors.Primary
                            ) 
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CatatinColors.Primary,
                            unfocusedBorderColor = CatatinColors.Border
                        ),
                        enabled = uiState !is LoginUiState.Loading
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Submit Button
                    Button(
                        onClick = {
                            viewModel.requestOtp { formattedPhone ->
                                onNavigateToVerifyOtp(formattedPhone)
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
                        enabled = uiState !is LoginUiState.Loading
                    ) {
                        if (uiState is LoginUiState.Loading) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        } else {
                            Text(
                                text = "Kirim OTP",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Registration Link
                    Row(
                        modifier = Modifier.clickable { 
                            if (uiState !is LoginUiState.Loading) onNavigateToRegister() 
                        },
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Belum punya akun? ",
                            style = MaterialTheme.typography.bodySmall,
                            color = CatatinColors.TextSecondary
                        )
                        Text(
                            text = "Daftar di sini",
                            style = MaterialTheme.typography.bodySmall,
                            color = CatatinColors.Primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
