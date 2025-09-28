// Application State
        let currentUser = null;
        let userRole = 'student';
        let currentLocation = null;
        let watchId = null;
        let currentEditingStudent = null;
        let currentEditingAttendance = null;
        let locationUpdateInterval = null;
        let realTimeTracking = false;

        // Campus coordinates and radius
        const CAMPUS_LAT = 21.08175;
        const CAMPUS_LNG = 79.09792;
        const CAMPUS_RADIUS = 30; // meters (or adjust as needed)


        // Real-time tracking state
        let studentLocations = new Map();
        let locationHistory = [];

        // Mock database
        let users = [
            {
                userId: "S001",
                name: "Manas K",
                email: "manas@email.com",
                password: "password123",
                role: "student",
                attendance: [
                    {
                        date: "2025-01-20",
                        entryTime: "09:01 AM",
                        exitTime: "04:55 PM",
                        status: "Present"
                    },
                    {
                        date: "2025-01-19",
                        entryTime: "09:15 AM",
                        exitTime: "05:00 PM",
                        status: "Present"
                    }
                ]
            },
            {
                userId: "S002",
                name: "Priya Sharma",
                email: "priya@email.com",
                password: "password123",
                role: "student",
                attendance: [
                    {
                        date: "2025-01-20",
                        entryTime: "08:45 AM",
                        exitTime: "04:30 PM",
                        status: "Present"
                    }
                ]
            },
            {
                userId: "A001",
                name: "Dr. Admin",
                email: "admin@email.com",
                password: "admin123",
                role: "admin",
                attendance: []
            }
        ];

        // Utility Functions
        function calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371e3; // Earth's radius in meters
            const φ1 = lat1 * Math.PI/180;
            const φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2-lat1) * Math.PI/180;
            const Δλ = (lon2-lon1) * Math.PI/180;

            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c;
        }

        function formatTime(date) {
            return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
        }

        function formatDate(date) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }

        function showNotification(message, type = 'success') {
            const notification = document.getElementById('notification');
            const notificationText = document.getElementById('notificationText');
            
            notificationText.textContent = message;
            
            let bgColor = 'bg-green-500';
            if (type === 'error') bgColor = 'bg-red-500';
            else if (type === 'info') bgColor = 'bg-blue-500';
            else if (type === 'warning') bgColor = 'bg-yellow-500';
            
            notification.className = `notification ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg show`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        // Real-time Location Tracking Functions
        function startRealTimeTracking() {
            if (!currentUser || currentUser.role !== 'student') return;
            
            realTimeTracking = true;
            
            // Update location every 10 seconds
            locationUpdateInterval = setInterval(() => {
                if (navigator.geolocation && realTimeTracking) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            updateStudentLocation(position);
                            sendLocationToServer(position);
                        },
                        (error) => {
                            console.warn('Real-time location update failed:', error);
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 8000,
                            maximumAge: 5000
                        }
                    );
                }
            }, 10000); // Update every 10 seconds
            
            showNotification('Real-time tracking started', 'info');
        }

        function stopRealTimeTracking() {
            realTimeTracking = false;
            if (locationUpdateInterval) {
                clearInterval(locationUpdateInterval);
                locationUpdateInterval = null;
            }
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
        }

        function updateStudentLocation(position) {
            const location = {
                userId: currentUser.userId,
                name: currentUser.name,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString(),
                accuracy: position.coords.accuracy
            };
            
            // Update current location
            currentLocation = {
                lat: location.lat,
                lng: location.lng
            };
            
            // Store in student locations map
            studentLocations.set(currentUser.userId, location);
            
            // Add to history
            locationHistory.push(location);
            
            // Keep only last 100 location points per student
            locationHistory = locationHistory.slice(-100);
            
            // Update UI
            updateLocationDisplay(location);
            
            // Check if student entered/left campus
            checkCampusEntry(location);
        }

        function sendLocationToServer(position) {
            // In a real app, this would send to your backend
            // For demo, we'll just store locally and simulate server response
            const locationData = {
                userId: currentUser.userId,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString(),
                inCampus: isLocationInCampus(position.coords.latitude, position.coords.longitude)
            };
            
            // Simulate server storage
            if (!currentUser.locationHistory) {
                currentUser.locationHistory = [];
            }
            currentUser.locationHistory.push(locationData);
            
            // Keep only last 50 location points
            currentUser.locationHistory = currentUser.locationHistory.slice(-50);
        }

        function checkCampusEntry(location) {
            const distance = calculateDistance(location.lat, location.lng, CAMPUS_LAT, CAMPUS_LNG);
            const isInCampus = distance <= CAMPUS_RADIUS;
            
            // Get previous location status
            const previousLocations = locationHistory.filter(l => l.userId === currentUser.userId);
            if (previousLocations.length >= 2) {
                const prevLocation = previousLocations[previousLocations.length - 2];
                const prevDistance = calculateDistance(prevLocation.lat, prevLocation.lng, CAMPUS_LAT, CAMPUS_LNG);
                const wasInCampus = prevDistance <= CAMPUS_RADIUS;
                
                // Check for campus entry/exit
                if (!wasInCampus && isInCampus) {
                    showNotification('🎯 You entered the campus!', 'success');
                    logCampusActivity('ENTERED');
                } else if (wasInCampus && !isInCampus) {
                    showNotification('🚪 You left the campus', 'info');
                    logCampusActivity('EXITED');
                }
            }
        }

        function logCampusActivity(action) {
            const activity = {
                userId: currentUser.userId,
                name: currentUser.name,
                action: action,
                timestamp: new Date().toISOString(),
                location: currentLocation
            };
            
            // Add to user's activity log
            if (!currentUser.campusActivity) {
                currentUser.campusActivity = [];
            }
            currentUser.campusActivity.push(activity);
            
            // Auto check-in when entering campus
            if (action === 'ENTERED') {
                setTimeout(() => {
                    const today = formatDate(new Date());
                    const existingRecord = currentUser.attendance.find(a => a.date === today);
                    if (!existingRecord || !existingRecord.entryTime) {
                        markAttendance('checkin');
                    }
                }, 2000);
            }
        }

        function isLocationInCampus(lat, lng) {
            const distance = calculateDistance(lat, lng, CAMPUS_LAT, CAMPUS_LNG);
            return distance <= CAMPUS_RADIUS;
        }

        function updateLocationDisplay(location) {
            const distance = calculateDistance(location.lat, location.lng, CAMPUS_LAT, CAMPUS_LNG);
            const isInCampus = distance <= CAMPUS_RADIUS;
            
            // Update location info
            document.getElementById('currentLocation').textContent = 
                `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}`;
            document.getElementById('distanceInfo').textContent = 
                `Distance: ${Math.round(distance)}m from campus (±${Math.round(location.accuracy)}m)`;
            
            // Update status indicator
            const locationStatus = document.getElementById('locationStatus');
            const checkInBtn = document.getElementById('checkInBtn');
            const checkOutBtn = document.getElementById('checkOutBtn');
            
            if (isInCampus) {
                locationStatus.innerHTML = `
                    <div class="w-3 h-3 bg-green-500 rounded-full mr-2 pulse-animation"></div>
                    <span class="text-green-600 font-medium">🎯 Inside Campus (Live)</span>
                `;
                checkInBtn.disabled = false;
                checkOutBtn.disabled = false;
            } else {
                locationStatus.innerHTML = `
                    <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span class="text-red-600 font-medium">📍 Outside Campus (Live)</span>
                `;
                checkInBtn.disabled = true;
                checkOutBtn.disabled = true;
            }
            
            // Update last seen time
            const lastSeenElement = document.getElementById('lastSeen');
            if (lastSeenElement) {
                lastSeenElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
        }

        // Location Functions
        async function requestLocationPermission() {
            try {
                // First check if geolocation is supported
                if (!navigator.geolocation) {
                    throw new Error('Geolocation is not supported by this browser');
                }

                // Request location immediately
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            console.log('Location permission granted:', position);
                            showNotification('Location access granted! Starting tracking...', 'success');
                            
                            // Immediately update location
                            updateLocation(position);
                            resolve(true);
                        },
                        (error) => {
                            console.error('Location permission error:', error);
                            handleLocationError(error);
                            reject(false);
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 30000
                        }
                    );
                });
            } catch (error) {
                console.error('Location request failed:', error);
                showNotification('Location access failed: ' + error.message, 'error');
                return false;
            }
        }

        async function startLocationTracking() {
            console.log('Starting location tracking...');
            
            // Update UI to show we're trying to get location
            const locationStatus = document.getElementById('locationStatus');
            if (locationStatus) {
                locationStatus.innerHTML = `
                    <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2 pulse-animation"></div>
                    <span class="text-yellow-600 font-medium">Getting location...</span>
                `;
            }

            try {
                // First request permission and get initial location
                const hasPermission = await requestLocationPermission();
                
                if (!hasPermission) {
                    showManualLocationOption();
                    return;
                }

                // Start real-time tracking for students
                if (currentUser && currentUser.role === 'student') {
                    startRealTimeTracking();
                }

                // Start continuous tracking with watchPosition
                if (navigator.geolocation) {
                    console.log('Starting watchPosition...');
                    watchId = navigator.geolocation.watchPosition(
                        (position) => {
                            console.log('Watch position update:', position);
                            updateLocation(position);
                        },
                        (error) => {
                            console.error('Watch position error:', error);
                            handleLocationError(error);
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 30000
                        }
                    );
                    console.log('WatchPosition started with ID:', watchId);
                }
            } catch (error) {
                console.error('Location tracking failed:', error);
                showManualLocationOption();
            }
        }

        function showManualLocationOption() {
            const locationStatus = document.getElementById('locationStatus');
            locationStatus.innerHTML = `
                <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span class="text-yellow-600 font-medium">Location Unavailable</span>
            `;

            // Remove old manual location option if already exists
let oldManualOption = document.getElementById("manualLocationOption");
if (oldManualOption) {
    oldManualOption.remove();
}

// Add manual location button (fresh)
const manualLocationDiv = document.createElement('div');
manualLocationDiv.id = "manualLocationOption";   // unique ID
manualLocationDiv.className = 'mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200';
manualLocationDiv.innerHTML = `
    <div class="flex items-center justify-between">
        <div>
            <p class="text-sm font-medium text-yellow-800">Location access required</p>
            <p class="text-xs text-yellow-600">Enable location or use manual check-in</p>
        </div>
        <div class="flex gap-2">
            <button onclick="retryLocation()" class="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700">
                Retry
            </button>
            <button onclick="useManualLocation()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                Manual
            </button>
        </div>
    </div>
`;

locationStatus.appendChild(manualLocationDiv);


            const locationCard = document.querySelector('.bg-white.rounded-xl.card-shadow.p-6.mb-8');
            locationCard.appendChild(manualLocationDiv);
        }

        function updateLocation(position) {
            console.log('Updating location:', position);
            
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            const distance = calculateDistance(
                currentLocation.lat,
                currentLocation.lng,
                CAMPUS_LAT,
                CAMPUS_LNG
            );

            const isInCampus = distance <= CAMPUS_RADIUS;
            
            console.log('Location update:', {
                lat: currentLocation.lat,
                lng: currentLocation.lng,
                distance: distance,
                isInCampus: isInCampus,
                accuracy: position.coords.accuracy
            });
            
            // Update UI elements
            const currentLocationEl = document.getElementById('currentLocation');
            const distanceInfoEl = document.getElementById('distanceInfo');
            const lastSeenEl = document.getElementById('lastSeen');
            const locationStatus = document.getElementById('locationStatus');
            const checkInBtn = document.getElementById('checkInBtn');
            const checkOutBtn = document.getElementById('checkOutBtn');

            if (currentLocationEl) {
                currentLocationEl.textContent = 
                    `Lat: ${currentLocation.lat.toFixed(6)}, Lng: ${currentLocation.lng.toFixed(6)}`;
            }
            
            if (distanceInfoEl) {
                distanceInfoEl.textContent = 
                    `Distance: ${Math.round(distance)}m from campus (±${Math.round(position.coords.accuracy || 0)}m)`;
            }
            
            if (lastSeenEl) {
                lastSeenEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }

            if (locationStatus) {
                if (isInCampus) {
                    locationStatus.innerHTML = `
                        <div class="w-3 h-3 bg-green-500 rounded-full mr-2 pulse-animation"></div>
                        <span class="text-green-600 font-medium">🎯 Inside Campus (Live)</span>
                    `;
                } else {
                    locationStatus.innerHTML = `
                        <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span class="text-red-600 font-medium">📍 Outside Campus (Live)</span>
                    `;
                }
            }

            if (checkInBtn && checkOutBtn) {
                checkInBtn.disabled = !isInCampus;
                checkOutBtn.disabled = !isInCampus;
            }
            
            // Update for real-time tracking if student
            if (currentUser && currentUser.role === 'student') {
                updateStudentLocation(position);
            }
        }

        function handleLocationError(error) {
            console.error('Location error:', error);
            
            let errorMessage = 'Location access failed. ';
            let showManual = false;
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please allow location access in your browser settings.';
                    showManual = true;
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable. Check your GPS/WiFi.';
                    showManual = true;
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out. Retrying...';
                    // Try again after timeout
                    setTimeout(() => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                updateLocation,
                                (retryError) => {
                                    console.error('Retry failed:', retryError);
                                    showManualLocationOption();
                                },
                                { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
                            );
                        }
                    }, 2000);
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
                    showManual = true;
                    break;
            }
            
            showNotification(errorMessage, 'error');
            
            // Update UI to show error state
            const locationStatus = document.getElementById('locationStatus');
            const currentLocationEl = document.getElementById('currentLocation');
            const distanceInfoEl = document.getElementById('distanceInfo');
            
            if (locationStatus) {
                locationStatus.innerHTML = `
                    <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span class="text-red-600 font-medium">Location Error</span>
                `;
            }
            
            if (currentLocationEl) {
                currentLocationEl.textContent = 'Location unavailable';
            }
            
            if (distanceInfoEl) {
                distanceInfoEl.textContent = 'Cannot calculate distance';
            }
            
            // Show manual option if needed
            if (showManual) {
                setTimeout(() => {
                    showManualLocationOption();
                }, 1000);
            }
        }

        // Authentication Functions
        function login(email, password, role) {
            const user = users.find(u => 
                u.email === email && 
                u.password === password && 
                u.role === role
            );

            if (user) {
                currentUser = user;
                userRole = role;
                
                if (role === 'student') {
                    showStudentDashboard();
                } else {
                    showAdminDashboard();
                }
                
                showNotification(`Welcome back, ${user.name}!`);
                return true;
            }
            
            showNotification('Invalid credentials', 'error');
            return false;
        }

        function logout() {
            // Stop real-time tracking
            stopRealTimeTracking();
            
            currentUser = null;
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
            showLoginScreen();
            showNotification('Logged out successfully');
        }

        // Screen Navigation
        function showLoginScreen() {
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('studentDashboard').classList.add('hidden');
            document.getElementById('adminDashboard').classList.add('hidden');
        }

        function showStudentDashboard() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('studentDashboard').classList.remove('hidden');
            document.getElementById('adminDashboard').classList.add('hidden');
            
            document.getElementById('studentName').textContent = `Welcome, ${currentUser.name}!`;
            updateStudentDashboard();
            startLocationTracking();
        }

        function showAdminDashboard() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('studentDashboard').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            
            updateAdminDashboard();
            updateStudentsTable();
        }

        // Student Dashboard Functions
        function updateStudentDashboard() {
            const today = new Date();
            const todayStr = formatDate(today);
            
            document.getElementById('todayDate').textContent = todayStr;
            
            // Find today's attendance
            const todayAttendance = currentUser.attendance.find(a => a.date === todayStr);
            
            if (todayAttendance) {
                document.getElementById('checkInTime').textContent = todayAttendance.entryTime || '--:--';
                document.getElementById('checkOutTime').textContent = todayAttendance.exitTime || '--:--';
            } else {
                document.getElementById('checkInTime').textContent = '--:--';
                document.getElementById('checkOutTime').textContent = '--:--';
            }
            
            // Update attendance history
            updateAttendanceHistory();
        }

        function updateAttendanceHistory() {
            const historyTable = document.getElementById('attendanceHistory');
            historyTable.innerHTML = '';
            
            currentUser.attendance.slice().reverse().forEach(record => {
                const row = document.createElement('tr');
                row.className = 'border-b border-gray-100 hover:bg-gray-50';
                
                const statusClass = record.status === 'Present' ? 'text-green-600 bg-green-100' : 
                                   record.status === 'Late' ? 'text-yellow-600 bg-yellow-100' : 
                                   'text-red-600 bg-red-100';
                
                row.innerHTML = `
                    <td class="py-3 px-4">${record.date}</td>
                    <td class="py-3 px-4">${record.entryTime || '--'}</td>
                    <td class="py-3 px-4">${record.exitTime || '--'}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                            ${record.status}
                        </span>
                    </td>
                `;
                
                historyTable.appendChild(row);
            });
        }

        function markAttendance(type) {
            if (!currentLocation) {
                showNotification('Location not available', 'error');
                return;
            }

            const distance = calculateDistance(
                currentLocation.lat,
                currentLocation.lng,
                CAMPUS_LAT,
                CAMPUS_LNG
            );

            if (distance > CAMPUS_RADIUS) {
                showNotification('You must be within campus to mark attendance', 'error');
                return;
            }

            const today = new Date();
            const todayStr = formatDate(today);
            const currentTime = formatTime(today);

            let attendanceRecord = currentUser.attendance.find(a => a.date === todayStr);
            
            if (!attendanceRecord) {
                attendanceRecord = {
                    date: todayStr,
                    entryTime: null,
                    exitTime: null,
                    status: 'Absent'
                };
                currentUser.attendance.push(attendanceRecord);
            }

            if (type === 'checkin') {
                if (attendanceRecord.entryTime) {
                    showNotification('Already checked in today', 'error');
                    return;
                }
                attendanceRecord.entryTime = currentTime;
                attendanceRecord.status = 'Present';
                showNotification('Checked in successfully!');
            } else {
                if (!attendanceRecord.entryTime) {
                    showNotification('Please check in first', 'error');
                    return;
                }
                if (attendanceRecord.exitTime) {
                    showNotification('Already checked out today', 'error');
                    return;
                }
                attendanceRecord.exitTime = currentTime;
                showNotification('Checked out successfully!');
            }

            updateStudentDashboard();
            updateAdminDashboard();
        }

        // Admin Dashboard Functions
        function updateAdminDashboard() {
            const today = formatDate(new Date());
            const students = users.filter(u => u.role === 'student');
            
            let presentCount = 0;
            let totalStudents = students.length;

            
            students.forEach(student => {
                const todayAttendance = student.attendance.find(a => a.date === today);
                if (todayAttendance && todayAttendance.status === 'Present') {
                    presentCount++;
                }
            });
            
            const absentCount = totalStudents - presentCount;
            const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
            
            document.getElementById('presentCount').textContent = presentCount;
            document.getElementById('absentCount').textContent = absentCount;
            document.getElementById('totalStudents').textContent = totalStudents;
            document.getElementById('attendanceRate').textContent = attendanceRate + '%';
            
            updateStudentsTable();
            updateLiveStudentTracking();
        }

        function updateLiveStudentTracking() {
            const liveGrid = document.getElementById('liveStudentGrid');
            if (!liveGrid) return;
            
            liveGrid.innerHTML = '';
            
            const students = users.filter(u => u.role === 'student');
            
            students.forEach(student => {
                const card = document.createElement('div');
                card.className = 'bg-gray-50 p-4 rounded-lg border';
                
                // Get latest location data
                let locationStatus = 'No location data';
                let statusColor = 'text-gray-500';
                let statusBg = 'bg-gray-100';
                let lastSeen = 'Never';
                
                if (student.locationHistory && student.locationHistory.length > 0) {
                    const latestLocation = student.locationHistory[student.locationHistory.length - 1];
                    const timeDiff = Date.now() - new Date(latestLocation.timestamp).getTime();
                    const minutesAgo = Math.floor(timeDiff / 1000 / 60);
                    
                    // Last seen calculation
                    if (minutesAgo < 2) {
                        lastSeen = 'Just now';
                    } else if (minutesAgo < 60) {
                        lastSeen = `${minutesAgo} min ago`;
                    } else {
                        const hoursAgo = Math.floor(minutesAgo / 60);
                        lastSeen = `${hoursAgo}h ago`;
                    }
                    
                    // Location status
                    if (latestLocation.inCampus === true) {
                        locationStatus = '🎯 On Campus';
                        statusColor = 'text-green-600';
                        statusBg = 'bg-green-100';
                    } else {
                        locationStatus = '📍 Off Campus';
                        statusColor = 'text-red-600';
                        statusBg = 'bg-red-100';
                    }

                    
                    // Check if data is stale (more than 5 minutes)
                    if (minutesAgo > 5) {
                        locationStatus = '⚠️ Location Stale';
                        statusColor = 'text-yellow-600';
                        statusBg = 'bg-yellow-100';
                    }
                }
                
                // Get today's attendance
                const today = formatDate(new Date());
                const todayAttendance = student.attendance.find(a => a.date === today);
                let attendanceStatus = 'Not marked';
                let attendanceColor = 'text-gray-500';
                
                if (todayAttendance) {
                    if (todayAttendance.entryTime && todayAttendance.exitTime) {
                        attendanceStatus = 'Complete';
                        attendanceColor = 'text-green-600';
                    } else if (todayAttendance.entryTime) {
                        attendanceStatus = 'Checked In';
                        attendanceColor = 'text-blue-600';
                    }
                }
                
                card.innerHTML = `
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center">
                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                <i class="fas fa-user text-blue-600 text-sm"></i>
                            </div>
                            <div>
                                <div class="font-medium text-gray-900">${student.name}</div>
                                <div class="text-xs text-gray-500">${student.userId}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Location:</span>
                            <span class="text-sm font-medium ${statusColor} ${statusBg} px-2 py-1 rounded-full">
                                ${locationStatus}
                            </span>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Attendance:</span>
                            <span class="text-sm font-medium ${attendanceColor}">
                                ${attendanceStatus}
                            </span>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Last seen:</span>
                            <span class="text-xs text-gray-500">${lastSeen}</span>
                        </div>
                    </div>
                    
                    <div class="mt-3 pt-3 border-t border-gray-200">
                        <div class="flex gap-2">
                            <button onclick="viewStudentDetails('${student.userId}')" class="flex-1 bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700">
                                <i class="fas fa-eye mr-1"></i>Details
                            </button>
                            <button onclick="trackStudent('${student.userId}')" class="flex-1 bg-green-600 text-white text-xs py-1 px-2 rounded hover:bg-green-700">
                                <i class="fas fa-map-marker-alt mr-1"></i>Track
                            </button>
                        </div>
                    </div>
                `;
                
                liveGrid.appendChild(card);
            });
            
            // If no students, show message
            if (students.length === 0) {
                liveGrid.innerHTML = `
                    <div class="col-span-full text-center py-8 text-gray-500">
                        <i class="fas fa-users text-4xl mb-4"></i>
                        <p>No students registered yet</p>
                    </div>
                `;
            }
        }

        function refreshLiveTracking() {
            updateLiveStudentTracking();
            showNotification('Live tracking data refreshed', 'info');
        }

        function viewStudentDetails(userId) {
    const student = users.find(u => u.userId === userId);
    if (!student) return;

    let content = `
        <p><strong>Name:</strong> ${student.name}</p>
        <p><strong>ID:</strong> ${student.userId}</p>
        <p><strong>Email:</strong> ${student.email}</p>
        <p><strong>Password:</strong> ${student.password}</p>
        
        <h4 class="mt-3 font-semibold">Attendance History (Last 5)</h4>
        <table class="w-full text-sm border">
          <thead><tr class="bg-gray-100">
            <th class="px-2 py-1">Date</th>
            <th class="px-2 py-1">Check In</th>
            <th class="px-2 py-1">Check Out</th>
            <th class="px-2 py-1">Status</th>
          </tr></thead>
          <tbody>
    `;

    student.attendance.slice(-5).reverse().forEach(record => {
        content += `
          <tr>
            <td class="border px-2 py-1">${record.date}</td>
            <td class="border px-2 py-1">${record.entryTime || '--'}</td>
            <td class="border px-2 py-1">${record.exitTime || '--'}</td>
            <td class="border px-2 py-1">${record.status}</td>
          </tr>
        `;
    });

    content += `</tbody></table>`;

    if (student.locationHistory && student.locationHistory.length > 0) {
        content += `<h4 class="mt-3 font-semibold">Recent Location Updates</h4><ul class="list-disc ml-5">`;
        student.locationHistory.slice(-5).reverse().forEach(loc => {
            const time = new Date(loc.timestamp).toLocaleTimeString();
            content += `<li>${time} - ${loc.inCampus ? '🎯 On Campus' : '📍 Off Campus'}</li>`;
        });
        content += `</ul>`;
    }

    document.getElementById('detailsModalTitle').textContent = `Details - ${student.name}`;
    document.getElementById('detailsModalContent').innerHTML = content;
    document.getElementById('studentDetailsModal').classList.remove('hidden');
}


function closeDetailsModal() {
    document.getElementById('studentDetailsModal').classList.add('hidden');
}

function trackStudent(userId) {
    const student = users.find(u => u.userId === userId);
    if (!student || !student.locationHistory || student.locationHistory.length === 0) {
        showNotification('No location data available', 'error');
        return;
    }

    const latestLocation = student.locationHistory[student.locationHistory.length - 1];
    const mapUrl = `https://www.google.com/maps?q=${latestLocation.lat},${latestLocation.lng}&z=18&output=embed`;

    let content = `
      <h4 class="mb-2 font-semibold">Latest Location</h4>
      <iframe src="${mapUrl}" width="100%" height="300" class="rounded border"></iframe>
      <p class="mt-2 text-sm text-gray-600">
        Status: ${latestLocation.inCampus ? '🎯 On Campus' : '📍 Off Campus'} <br>
        Last updated: ${new Date(latestLocation.timestamp).toLocaleTimeString()}
      </p>
    `;

    document.getElementById('detailsModalTitle').textContent = `Tracking - ${student.name}`;
    document.getElementById('detailsModalContent').innerHTML = content;
    document.getElementById('studentDetailsModal').classList.remove('hidden');
}


        function updateStudentsTable() {
            const table = document.getElementById('studentsTable');
            table.innerHTML = '';
            
            const students = users.filter(u => u.role === 'student');
            const searchTerm = document.getElementById('searchStudent').value.toLowerCase();
            const filterDate = document.getElementById('filterDate').value;
            
            students.forEach(student => {
                if (searchTerm && !student.name.toLowerCase().includes(searchTerm)) {
                    return;
                }
                
                const attendanceRecords = filterDate ? 
                    student.attendance.filter(a => a.date === filterDate) :
                    student.attendance.slice(-5); // Show last 5 records
                
                if (attendanceRecords.length === 0) {
                    // Show student even if no attendance records
                    const row = document.createElement('tr');
                    row.className = 'border-b border-gray-100 hover:bg-gray-50';
                    
                    row.innerHTML = `
                        <td class="py-3 px-6">${student.userId}</td>
                        <td class="py-3 px-6 font-medium">${student.name}</td>
                        <td class="py-3 px-6">--</td>
                        <td class="py-3 px-6">--</td>
                        <td class="py-3 px-6">--</td>
                        <td class="py-3 px-6">
                            <span class="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
                                No Record
                            </span>
                        </td>
                        <td class="py-3 px-6">
                            <div class="flex gap-2">
                                <button onclick="editStudent('${student.userId}')" class="text-blue-600 hover:text-blue-800">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteStudent('${student.userId}')" class="text-red-600 hover:text-red-800">
                                    <i class="fas fa-trash"></i>
                                </button>
                                <button onclick="manualAttendance('${student.userId}')" class="text-green-600 hover:text-green-800">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    
                    table.appendChild(row);
                } else {
                    attendanceRecords.forEach(record => {
                        const row = document.createElement('tr');
                        row.className = 'border-b border-gray-100 hover:bg-gray-50';
                        
                        const statusClass = record.status === 'Present' ? 'text-green-600 bg-green-100' : 
                                           record.status === 'Late' ? 'text-yellow-600 bg-yellow-100' : 
                                           'text-red-600 bg-red-100';
                        
                        // Get location info
                        let locationInfo = 'No location data';
                        if (student.locationHistory && student.locationHistory.length > 0) {
                            const lastLocation = student.locationHistory[student.locationHistory.length - 1];
                            const distance = calculateDistance(
                                lastLocation.lat,
                                lastLocation.lng,
                                CAMPUS_LAT,
                                CAMPUS_LNG
                            );
                            const isOnCampus = distance <= CAMPUS_RADIUS;
                            const timeSinceUpdate = Math.round((new Date() - new Date(lastLocation.timestamp)) / 1000 / 60);
                            locationInfo = `${isOnCampus ? 'On Campus' : 'Off Campus'} (${Math.round(distance)}m, ${timeSinceUpdate}min ago)`;
                        }
                        
                        row.innerHTML = `
                            <td class="py-3 px-6">${student.userId}</td>
                            <td class="py-3 px-6 font-medium">${student.name}</td>
                            <td class="py-3 px-6">${record.date}</td>
                            <td class="py-3 px-6">${record.entryTime || '--'}</td>
                            <td class="py-3 px-6">${record.exitTime || '--'}</td>
                            <td class="py-3 px-6">
                                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                                    ${record.status}
                                </span>
                            </td>
                            <td class="py-3 px-6">
                                <div class="text-xs text-gray-600">${locationInfo}</div>
                            </td>
                            <td class="py-3 px-6">
                                <div class="flex gap-2">
                                    <button onclick="editStudent('${student.userId}')" class="text-blue-600 hover:text-blue-800">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteStudent('${student.userId}')" class="text-red-600 hover:text-red-800">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    <button onclick="editAttendance('${student.userId}', '${record.date}')" class="text-yellow-600 hover:text-yellow-800">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                        
                        table.appendChild(row);
                    });
                }
            });
        }

        // Student Management Functions
        function addStudent() {
            document.getElementById('modalTitle').textContent = 'Add New Student';
            document.getElementById('studentForm').reset();
            currentEditingStudent = null;
            document.getElementById('studentModal').classList.remove('hidden');
        }

        function editStudent(userId) {
            const student = users.find(u => u.userId === userId);
            if (!student) return;
            
            document.getElementById('modalTitle').textContent = 'Edit Student';
            document.getElementById('studentId').value = student.userId;
            document.getElementById('studentNameInput').value = student.name;
            document.getElementById('studentEmail').value = student.email;
            document.getElementById('studentPassword').value = student.password;
            
            currentEditingStudent = userId;
            document.getElementById('studentModal').classList.remove('hidden');
        }

        function deleteStudent(userId) {
            if (confirm('Are you sure you want to delete this student?')) {
                users = users.filter(u => u.userId !== userId);
                updateAdminDashboard();
                showNotification('Student deleted successfully');
            }
        }

        function saveStudent(event) {
            event.preventDefault();
            
            const studentData = {
                userId: document.getElementById('studentId').value,
                name: document.getElementById('studentNameInput').value,
                email: document.getElementById('studentEmail').value,
                password: document.getElementById('studentPassword').value,
                role: 'student',
                attendance: []
            };
            
            if (currentEditingStudent) {
                // Edit existing student
                const index = users.findIndex(u => u.userId === currentEditingStudent);
                if (index !== -1) {
                    users[index] = { ...users[index], ...studentData };
                    showNotification('Student updated successfully');
                }
            } else {
                // Add new student
                if (users.find(u => u.userId === studentData.userId)) {
                    showNotification('Student ID already exists', 'error');
                    return;
                }
                users.push(studentData);
                showNotification('Student added successfully');
            }
            
            document.getElementById('studentModal').classList.add('hidden');
            updateAdminDashboard();
        }

        // Manual Attendance Functions
        function manualAttendance(userId) {
            const student = users.find(u => u.userId === userId);
            if (!student) return;
            
            currentEditingAttendance = { userId, date: null };
            document.getElementById('manualDate').value = formatDate(new Date()).split('/').reverse().join('-');
            document.getElementById('manualCheckIn').value = '';
            document.getElementById('manualCheckOut').value = '';
            document.getElementById('manualStatus').value = 'Present';
            
            document.getElementById('manualAttendanceModal').classList.remove('hidden');
        }

        function editAttendance(userId, date) {
            const student = users.find(u => u.userId === userId);
            if (!student) return;
            
            const attendance = student.attendance.find(a => a.date === date);
            if (!attendance) return;
            
            currentEditingAttendance = { userId, date };
            
            // Convert date format for input
            const dateParts = date.split('/');
            const formattedDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
            
            document.getElementById('manualDate').value = formattedDate;
            
            // Convert time format for input
            const convertTimeToInput = (timeStr) => {
                if (!timeStr || timeStr === '--') return '';
                const [time, period] = timeStr.split(' ');
                const [hours, minutes] = time.split(':');
                let hour24 = parseInt(hours);
                if (period === 'PM' && hour24 !== 12) hour24 += 12;
                if (period === 'AM' && hour24 === 12) hour24 = 0;
                return `${hour24.toString().padStart(2, '0')}:${minutes}`;
            };
            
            document.getElementById('manualCheckIn').value = convertTimeToInput(attendance.entryTime);
            document.getElementById('manualCheckOut').value = convertTimeToInput(attendance.exitTime);
            document.getElementById('manualStatus').value = attendance.status;
            
            document.getElementById('manualAttendanceModal').classList.remove('hidden');
        }

        function saveManualAttendance(event) {
            event.preventDefault();
            
            const userId = currentEditingAttendance.userId;
            const student = users.find(u => u.userId === userId);
            if (!student) return;
            
            const dateInput = document.getElementById('manualDate').value;
            const checkInInput = document.getElementById('manualCheckIn').value;
            const checkOutInput = document.getElementById('manualCheckOut').value;
            const status = document.getElementById('manualStatus').value;
            
            // Convert date format
            const dateObj = new Date(dateInput);
            const formattedDate = formatDate(dateObj);
            
            // Convert time format
            const convertInputToTime = (timeStr) => {
                if (!timeStr) return null;
                const [hours, minutes] = timeStr.split(':');
                const hour24 = parseInt(hours);
                const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                const period = hour24 >= 12 ? 'PM' : 'AM';
                return `${hour12}:${minutes} ${period}`;
            };
            
            const entryTime = convertInputToTime(checkInInput);
            const exitTime = convertInputToTime(checkOutInput);
            
            // Find or create attendance record
            let attendanceRecord = student.attendance.find(a => a.date === formattedDate);
            
            if (attendanceRecord) {
                // Update existing record
                attendanceRecord.entryTime = entryTime;
                attendanceRecord.exitTime = exitTime;
                attendanceRecord.status = status;
            } else {
                // Create new record
                attendanceRecord = {
                    date: formattedDate,
                    entryTime: entryTime,
                    exitTime: exitTime,
                    status: status
                };
                student.attendance.push(attendanceRecord);
            }
            
            document.getElementById('manualAttendanceModal').classList.add('hidden');
            updateAdminDashboard();
            showNotification('Attendance updated successfully');
        }

        // Export Functions
        function exportToCSV() {
            const students = users.filter(u => u.role === 'student');
            let csvContent = 'Student ID,Name,Date,Check In,Check Out,Status\n';
            
            students.forEach(student => {
                student.attendance.forEach(record => {
                    csvContent += `${student.userId},${student.name},${record.date},${record.entryTime || ''},${record.exitTime || ''},${record.status}\n`;
                });
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_${formatDate(new Date()).replace(/\//g, '-')}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            showNotification('CSV exported successfully');
        }

        function exportToPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(20);
            doc.text('Smart Geo Campus - Attendance Report', 20, 20);
            
            doc.setFontSize(12);
            doc.text(`Generated on: ${formatDate(new Date())}`, 20, 35);
            
            let yPosition = 50;
            const students = users.filter(u => u.role === 'student');
            
            students.forEach(student => {
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                doc.setFontSize(14);
                doc.text(`${student.name} (${student.userId})`, 20, yPosition);
                yPosition += 10;
                
                doc.setFontSize(10);
                student.attendance.forEach(record => {
                    if (yPosition > 270) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    
                    doc.text(`  ${record.date} | ${record.entryTime || '--'} | ${record.exitTime || '--'} | ${record.status}`, 25, yPosition);
                    yPosition += 7;
                });
                
                yPosition += 5;
            });
            
            doc.save(`attendance_${formatDate(new Date()).replace(/\//g, '-')}.pdf`);
            showNotification('PDF exported successfully');
        }

        // Event Listeners
        document.addEventListener('DOMContentLoaded', function() {
            // Tab switching
            document.getElementById('studentTab').addEventListener('click', function() {
                userRole = 'student';
                this.classList.add('bg-blue-600', 'text-white');
                this.classList.remove('text-gray-600');
                document.getElementById('adminTab').classList.remove('bg-blue-600', 'text-white');
                document.getElementById('adminTab').classList.add('text-gray-600');
            });

            document.getElementById('adminTab').addEventListener('click', function() {
                userRole = 'admin';
                this.classList.add('bg-blue-600', 'text-white');
                this.classList.remove('text-gray-600');
                document.getElementById('studentTab').classList.remove('bg-blue-600', 'text-white');
                document.getElementById('studentTab').classList.add('text-gray-600');
            });

            // Login form
            document.getElementById('loginForm').addEventListener('submit', function(e) {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                login(email, password, userRole);
            });

            // Logout buttons
            document.getElementById('studentLogout').addEventListener('click', logout);
            document.getElementById('adminLogout').addEventListener('click', logout);

            // Attendance buttons
            document.getElementById('checkInBtn').addEventListener('click', () => markAttendance('checkin'));
            document.getElementById('checkOutBtn').addEventListener('click', () => markAttendance('checkout'));

            // Admin controls
            document.getElementById('searchStudent').addEventListener('input', updateStudentsTable);
            document.getElementById('filterDate').addEventListener('change', updateStudentsTable);
            document.getElementById('addStudentBtn').addEventListener('click', addStudent);
            document.getElementById('exportCSV').addEventListener('click', exportToCSV);
            document.getElementById('exportPDF').addEventListener('click', exportToPDF);
            
            // Location tracking refresh
            if (document.getElementById('refreshLocations')) {
                document.getElementById('refreshLocations').addEventListener('click', () => {
                    updateLocationTracking();
                    showNotification('Location data refreshed');
                });
            }

            // Modal controls
            document.getElementById('closeModal').addEventListener('click', () => {
                document.getElementById('studentModal').classList.add('hidden');
            });
            document.getElementById('cancelModal').addEventListener('click', () => {
                document.getElementById('studentModal').classList.add('hidden');
            });
            document.getElementById('studentForm').addEventListener('submit', saveStudent);

            // Manual attendance modal
            document.getElementById('closeManualModal').addEventListener('click', () => {
                document.getElementById('manualAttendanceModal').classList.add('hidden');
            });
            document.getElementById('cancelManualModal').addEventListener('click', () => {
                document.getElementById('manualAttendanceModal').classList.add('hidden');
            });
            document.getElementById('manualAttendanceForm').addEventListener('submit', saveManualAttendance);

            // Set today's date as default filter
            document.getElementById('filterDate').value = new Date().toISOString().split('T')[0];
        });

        // Manual location functions
        async function retryLocation() {
            showNotification('Retrying location access...', 'info');
            
            // Remove any existing manual location UI
            const existingManualDiv = document.querySelector('.bg-yellow-50');
            if (existingManualDiv) {
                existingManualDiv.remove();
            }
            
            // Reset location status
            const locationStatus = document.getElementById('locationStatus');
            locationStatus.innerHTML = `
                <div class="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <span class="text-gray-500">Checking location...</span>
            `;
            
            // Try location tracking again
            await startLocationTracking();
        }

        function useManualLocation() {
            // Simulate being on campus for manual check-in
            currentLocation = {
                lat: CAMPUS_LAT,
                lng: CAMPUS_LNG
            };
            
            const locationStatus = document.getElementById('locationStatus');
            locationStatus.innerHTML = `
                <div class="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span class="text-blue-600 font-medium">Manual Mode</span>
            `;
            
            document.getElementById('currentLocation').textContent = 'Manual location (Campus)';
            document.getElementById('distanceInfo').textContent = 'Distance: 0m from campus';
            
            // Enable check-in/out buttons
            const checkInBtn = document.getElementById('checkInBtn');
            const checkOutBtn = document.getElementById('checkOutBtn');
            checkInBtn.disabled = false;
            checkOutBtn.disabled = false;
            
            // Remove manual location UI
            const existingManualDiv = document.querySelector('.bg-yellow-50');
            if (existingManualDiv) {
                existingManualDiv.remove();
            }
            
            showNotification('Manual location mode enabled. You can now check in/out.', 'info');
        }

        function simulateLocationForDemo() {
            // For demo purposes - simulate different locations
            const locations = [
                { lat: CAMPUS_LAT, lng: CAMPUS_LNG, name: "Campus Center" },
                { lat: CAMPUS_LAT + 0.001, lng: CAMPUS_LNG + 0.001, name: "Near Campus" },
                { lat: CAMPUS_LAT + 0.01, lng: CAMPUS_LNG + 0.01, name: "Off Campus" }
            ];
            
            const randomLocation = locations[Math.floor(Math.random() * locations.length)];
            
            currentLocation = {
                lat: randomLocation.lat,
                lng: randomLocation.lng
            };
            
            // Simulate a position object for updateLocation
            const mockPosition = {
                coords: {
                    latitude: randomLocation.lat,
                    longitude: randomLocation.lng
                }
            };
            
            updateLocation(mockPosition);
            showNotification(`Demo location set: ${randomLocation.name}`, 'info');
        }

        // Global functions for onclick handlers
        window.editStudent = editStudent;
        window.deleteStudent = deleteStudent;
        window.manualAttendance = manualAttendance;
        window.editAttendance = editAttendance;
        window.retryLocation = retryLocation;
        window.useManualLocation = useManualLocation;
        window.simulateLocationForDemo = simulateLocationForDemo;
        window.refreshLiveTracking = refreshLiveTracking;
        window.viewStudentDetails = viewStudentDetails;
        window.trackStudent = trackStudent;
    

(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'97e613b2d4f07143',t:'MTc1Nzc1MDA3MC4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();