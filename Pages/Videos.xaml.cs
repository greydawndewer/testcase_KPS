using kpsk.Models;
using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using System.Windows.Data;
using System.Runtime.Remoting.Activation;

namespace kpsk.Pages
{
    public partial class Videos : Page
    {
        private ObservableCollection<VideoModel> AllVideos;
        public ObservableCollection<VideoModel> FilteredVideos { get; set; }

        private bool _isDraggingSeek = false;
        private bool _isPlaying = false;
        private bool _isFullscreen = false;
        private bool _isMuted = false;
        private double _lastVolume = 0.5;
        private DispatcherTimer _timer;
        private Window _fullscreenWindow;
        private Grid _originalParent;
        private int _originalIndex;

        public Videos()
        {
            InitializeComponent();

            // Initialize videos with properly loaded thumbnails
            AllVideos = new ObservableCollection<VideoModel>
            {
                CreateVideoModel("Video 1", "Assets/oppa.mp4", "Assets/asa.jpg", "Beginner"),
                CreateVideoModel("Video 2   ", "Assets/popa.mp4", "Assets/asa.jpg", "Intermediate"),
            };

            FilteredVideos = new ObservableCollection<VideoModel>(AllVideos);
            DataContext = this;

            // Setup timer for seekbar updates
            _timer = new DispatcherTimer();
            _timer.Interval = TimeSpan.FromMilliseconds(100);
            _timer.Tick += Timer_Tick;

            // Set initial volume
            VolumeSlider.Value = 0.5;

            // Set initial search box text
            SearchBox.Text = "Type full video name...";
            SearchBox.Foreground = Brushes.Gray;
        }
        private void ClosePlayer()
        {
            // 1. FULL MEDIA RESET
            Player.Stop();
            Player.Source = null;
            Player.Close();

            // 2. TIMER RESET
            _timer.Stop();
            _timer.Tick -= Timer_Tick;
            _timer = new DispatcherTimer();
            _timer.Interval = TimeSpan.FromMilliseconds(100);
            _timer.Tick += Timer_Tick;

            // 3. UI RESET
            PlayerOverlay.Visibility = Visibility.Collapsed;
            _isPlaying = false;
            _isDraggingSeek = false;

            // 4. CONTROLS RESET
            SeekBar.Value = 0;
            CurrentTimeText.Text = "00:00";
            TotalTimeText.Text = "00:00";
            PlayPauseIcon.Text = "▶";
        }

        private void Thumbnail_Click(object sender, MouseButtonEventArgs e)
        {
            if (!(sender is Border border) || !(border.DataContext is VideoModel video))
                return;

            try
            {
                // RESET BEFORE LOADING NEW VIDEO
                ClosePlayer();

                Player.Source = new Uri(video.Path, UriKind.RelativeOrAbsolute);
                PlayerOverlay.Visibility = Visibility.Visible;
                TogglePlayPause();
                PlayPauseIcon.Text = "⏸";
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error loading video: {ex.Message}");
            }
        }

        private void Player_MediaOpened(object sender, RoutedEventArgs e)
        {
            if (!Player.NaturalDuration.HasTimeSpan)
                return;

            SeekBar.Minimum = 0;
            SeekBar.Value = 0;
            SeekBar.Maximum = Player.NaturalDuration.TimeSpan.TotalSeconds;

            // SAFE PLAYBACK START
            Dispatcher.BeginInvoke((Action)(() =>
            {
                Player.Play();
                _timer.Start();
                UpdateTimeDisplay();
            }));
        }

        private void Player_MediaEnded(object sender, RoutedEventArgs e)
        {
            // SAFE MEDIA END HANDLING
            Dispatcher.BeginInvoke((Action)(() =>
            {
                _isPlaying = false;
                PlayPauseIcon.Text = "▶";
                ClosePlayer();
            }));
        }
        private VideoModel CreateVideoModel(string name, string path, string thumbPath, string level)
        {
            return new VideoModel
            {
                Name = name,
                Level = level,
                Path = path,
                ThumbPath = thumbPath,
                Thumb = LoadImage(thumbPath)
            };
        }

        private BitmapImage LoadImage(string path)
        {
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;

                // Use application-relative URI
                bitmap.UriSource = new Uri($"pack://application:,,,/{path}");

                bitmap.EndInit();
                return bitmap;
            }
            catch
            {
                // Return null if image can't be loaded
                var fallback = new BitmapImage();
                fallback.BeginInit();
                fallback.UriSource = new Uri("pack://application:,,,/Assets/asa.jpg");
                fallback.EndInit();
                return fallback;
            }
        }

        private void Timer_Tick(object sender, EventArgs e)
        {
            if (Player.Source == null || !Player.NaturalDuration.HasTimeSpan)
                return;

            // Always update seekbar from player position
            if (!_isDraggingSeek)
            {
                SeekBar.Value = Player.Position.TotalSeconds;
                UpdateTimeDisplay();
            }
        }

        private void UpdateTimeDisplay()
        {
            if (Player.NaturalDuration.HasTimeSpan)
            {
                CurrentTimeText.Text = Player.Position.ToString(@"mm\:ss");
                TotalTimeText.Text = Player.NaturalDuration.TimeSpan.ToString(@"mm\:ss");
            }
        }

        private void SearchButton_Click(object sender, RoutedEventArgs e)
        {
            var query = SearchBox.Text.Trim().ToLower();

            // Skip search if placeholder text
            if (query == "type full video name...")
            {
                FilteredVideos = new ObservableCollection<VideoModel>(AllVideos);
                Gallery.ItemsSource = FilteredVideos;
                return;
            }

            var match = AllVideos.Where(v => v.Name.ToLower().Contains(query)).ToList();

            FilteredVideos.Clear();
            foreach (var v in match) FilteredVideos.Add(v);
        }

        private void SearchBox_GotFocus(object sender, RoutedEventArgs e)
        {
            if (SearchBox.Text == "Type full video name...")
            {
                SearchBox.Text = "";
            }
        }

        private void SearchBox_LostFocus(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(SearchBox.Text))
            {
                SearchBox.Text = "Type full video name...";
            }
        }

        private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (Keyboard.IsKeyDown(Key.Enter))
                SearchButton_Click(null, null);
        }







        private void Player_MediaFailed(object sender, ExceptionRoutedEventArgs e)
        {
            _timer.Stop();
            MessageBox.Show($"Media failed: {e.ErrorException?.Message}");
        }

        private void PlayPause_Click(object sender, RoutedEventArgs e)
        {
            TogglePlayPause();
        }

        private void TogglePlayPause()
        {
            if (_isPlaying)
            {
                Player.Pause();
                _isPlaying = false;
                PlayPauseIcon.Text = "▶";
            }
            else
            {
                if (Player.NaturalDuration.HasTimeSpan &&
                    Player.Position >= Player.NaturalDuration.TimeSpan)
                {
                    Player.Position = TimeSpan.Zero;
                    SeekBar.Value = 0;
                }

                Player.Play();
                _isPlaying = true;
                PlayPauseIcon.Text = "⏸";
            }
        }

        private void SeekBar_DragStarted(object sender, DragStartedEventArgs e)
        {
            _isDraggingSeek = true;
            Player.Pause();
        }

        private void SeekBar_DragCompleted(object sender, DragCompletedEventArgs e)
        {
            Player.Position = TimeSpan.FromSeconds(SeekBar.Value);
            if (_isPlaying)
            {
                Player.Play();
            }
            _isDraggingSeek = false;
        }

        private void SeekBar_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_isDraggingSeek)
            {
                Player.Position = TimeSpan.FromSeconds(SeekBar.Value);
                UpdateTimeDisplay();
            }
        }

        private void SeekBar_PreviewMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (Player.Source == null || !Player.NaturalDuration.HasTimeSpan)
                return;

            var seekBar = (Slider)sender;
            Point mousePos = e.GetPosition(seekBar);
            double newValue = (mousePos.X / seekBar.ActualWidth) * seekBar.Maximum;

            // Set the new position
            _isDraggingSeek = true;
            seekBar.Value = newValue;
            Player.Position = TimeSpan.FromSeconds(newValue);

            // If we were playing before, continue playing
            if (_isPlaying)
            {
                Player.Play();
            }

            _isDraggingSeek = false;
            UpdateTimeDisplay();
        }

        private void VolumeSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            Player.Volume = VolumeSlider.Value;
            UpdateVolumeIcon();
        }

        private void VolumeButton_Click(object sender, RoutedEventArgs e)
        {
            ToggleMute();
        }

        private void ToggleMute()
        {
            if (_isMuted)
            {
                // Unmute
                Player.Volume = _lastVolume;
                VolumeSlider.Value = _lastVolume;
                _isMuted = false;
            }
            else
            {
                // Mute
                _lastVolume = Player.Volume;
                Player.Volume = 0;
                VolumeSlider.Value = 0;
                _isMuted = true;
            }
            UpdateVolumeIcon();
        }

        private void UpdateVolumeIcon()
        {
            if (_isMuted)
            {
                VolumeIcon.Text = "🔇";
            }
            else
            {
                if (Player.Volume == 0)
                {
                    VolumeIcon.Text = "🔇";
                }
                else if (Player.Volume < 0.33)
                {
                    VolumeIcon.Text = "🔈";
                }
                else if (Player.Volume < 0.66)
                {
                    VolumeIcon.Text = "🔉";
                }
                else
                {
                    VolumeIcon.Text = "🔊";
                }
            }
        }

        private void FullScreenButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isFullscreen)
                ExitFullScreen();
            else
                EnterFullScreen();
        }

        private void EnterFullScreen()
        {
            if (_isFullscreen) return;

            _isFullscreen = true;
            FullScreenIcon.Text = "🗖";

            // Store original parent
            _originalParent = (Grid)PlayerOverlay.Parent;
            _originalIndex = _originalParent.Children.IndexOf(PlayerOverlay);

            // Create fullscreen window
            _fullscreenWindow = new Window
            {
                WindowStyle = WindowStyle.None,
                WindowState = WindowState.Maximized,
                Background = Brushes.Black,
                Title = "Video Player",
                Content = PlayerOverlay
            };

            // Remove from original parent
            _originalParent.Children.Remove(PlayerOverlay);

            // Show fullscreen window
            _fullscreenWindow.KeyDown += FullScreenWindow_KeyDown;
            _fullscreenWindow.Show();
        }

        private void ExitFullScreen()
        {
            if (!_isFullscreen) return;

            _isFullscreen = false;
            FullScreenIcon.Text = "⛶";

            // Clean up fullscreen window
            _fullscreenWindow.Content = null;
            _fullscreenWindow.KeyDown -= FullScreenWindow_KeyDown;
            _fullscreenWindow.Close();
            _fullscreenWindow = null;

            // Restore to original parent
            _originalParent.Children.Insert(_originalIndex, PlayerOverlay);
        }

        private void ClosePlayer_Click(object sender, RoutedEventArgs e)
        {
            ClosePlayer();
        }


        private void FullScreenWindow_KeyDown(object sender, KeyEventArgs e)
        {
            switch (e.Key)
            {
                case Key.Escape:
                    ClosePlayer();
                    break;
                case Key.Space:
                    TogglePlayPause();
                    break;
                case Key.F:
                    if (Keyboard.Modifiers == ModifierKeys.None)
                        ExitFullScreen();
                    break;
                case Key.X:
                    ClosePlayer();
                    break;
                case Key.M:
                    ToggleMute();
                    break;
                case Key.Up:
                    VolumeSlider.Value = Math.Min(1, VolumeSlider.Value + 0.1);
                    break;
                case Key.Down:
                    VolumeSlider.Value = Math.Max(0, VolumeSlider.Value - 0.1);
                    break;
            }
        }
    }
}