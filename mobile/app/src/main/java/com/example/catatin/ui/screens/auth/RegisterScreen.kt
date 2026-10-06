package com.example.catatin.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
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

@Composable
fun RegisterScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToVerifyOtp: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RegisterViewModel = koinViewModel()
) {
    val name by viewModel.name.collectAsState()
    val phone by viewModel.phone.collectAsState()
    val businessName by viewModel.businessName.collectAsState()
    val businessType by viewModel.businessType.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    val scrollState = rememberScrollState()

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
                .padding(24.dp)
                .verticalScroll(scrollState),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "CatatIN",
                style = MaterialTheme.typography.displayMedium,
                color = Color.White,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Register Card
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
                        text = "Daftar Akun Baru",
                        style = MaterialTheme.typography.headlineSmall,
                        color = CatatinColors.TextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Text(
                        text = "Kelola bisnis dan kirim catatan via WhatsApp dengan mudah",
                        style = MaterialTheme.typography.bodySmall,
                        color = CatatinColors.TextSecondary,
                        modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
                        textAlign = TextAlign.Center
                    )

                    // Error message
                    if (uiState is RegisterUiState.Error) {
                        Surface(
                            color = CatatinColors.DangerLight,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                        ) {
                            Text(
                                text = (uiState as RegisterUiState.Error).message,
                                color = CatatinColors.Danger,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(12.dp),
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    // Input Name
                    OutlinedTextField(
                        value = name,
                        onValueChange = { 
                            viewModel.clearError()
                            viewModel.updateName(it) 
                        },
                        label = { Text("Nama Lengkap") },
                        placeholder = { Text("Masukkan nama Anda") },
                        leadingIcon = { 
                            Icon(Icons.Default.Person, contentDescription = "User icon", tint = CatatinColors.Primary) 
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CatatinColors.Primary,
                            unfocusedBorderColor = CatatinColors.Border
                        ),
                        enabled = uiState !is RegisterUiState.Loading
                    )

                    Spacer(modifier = Modifier.height(16.dp))

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
                            Icon(Icons.Default.Phone, contentDescription = "Phone icon", tint = CatatinColors.Primary) 
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CatatinColors.Primary,
                            unfocusedBorderColor = CatatinColors.Border
                        ),
                        enabled = uiState !is RegisterUiState.Loading
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Input Business Name
                    OutlinedTextField(
                        value = businessName,
                        onValueChange = { 
                            viewModel.clearError()
                            viewModel.updateBusinessName(it) 
                        },
                        label = { Text("Nama Usaha / Bisnis") },
                        placeholder = { Text("Contoh: Toko Berkah Mandiri") },
                        leadingIcon = { 
                            Icon(Icons.Default.Business, contentDescription = "Business icon", tint = CatatinColors.Primary) 
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CatatinColors.Primary,
                            unfocusedBorderColor = CatatinColors.Border
                        ),
                        enabled = uiState !is RegisterUiState.Loading
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // Business Type Selector (Personal vs UMKM)
                    Text(
                        text = "Tipe Entitas",
                        style = MaterialTheme.typography.bodySmall,
                        color = CatatinColors.TextSecondary,
                        modifier = Modifier.align(Alignment.Start)
                    )
                    
                    Spacer(modifier = Modifier.height(6.dp))
                    
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                            .background(CatatinColors.SurfaceVariant, RoundedCornerShape(10.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        val isPersonal = businessType == "personal"
                        
                        // Personal Option
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .background(
                                    if (isPersonal) CatatinColors.Primary else Color.Transparent,
                                    RoundedCornerShape(8.dp)
                                )
                                .clickable { viewModel.updateBusinessType("personal") }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "Personal",
                                color = if (isPersonal) Color.White else CatatinColors.TextSecondary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                        }

                        // UMKM Option
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .background(
                                    if (!isPersonal) CatatinColors.Primary else Color.Transparent,
                                    RoundedCornerShape(8.dp)
                                )
                                .clickable { viewModel.updateBusinessType("umkm") }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "UMKM / Usaha",
                                color = if (!isPersonal) Color.White else CatatinColors.TextSecondary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(28.dp))

                    // Submit Button
                    Button(
                        onClick = {
                            viewModel.register { formattedPhone ->
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
                        enabled = uiState !is RegisterUiState.Loading
                    ) {
                        if (uiState is RegisterUiState.Loading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                text = "Daftar Sekarang",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Login Link
                    Row(
                        modifier = Modifier.clickable { 
                            if (uiState !is RegisterUiState.Loading) onNavigateToLogin() 
                        },
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Sudah punya akun? ",
                            style = MaterialTheme.typography.bodySmall,
                            color = CatatinColors.TextSecondary
                        )
                        Text(
                            text = "Masuk di sini",
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
