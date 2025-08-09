using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;
using System.Xml.Linq;

namespace kpsk
{
    /// <summary>
    /// Interaction logic for SplashWindow.xaml
    /// </summary>
    public partial class SplashWindow : Window
    {
        private bool _isClosing = false;
        public SplashWindow()
        {
            InitializeComponent();
            Loaded += SplashWindow_Loaded;
            // Add media failed handler
            IntroVideo.MediaFailed += IntroVideo_MediaFailed;
        }

        private async void SplashWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                this.WindowState = WindowState.Maximized;
                this.WindowStyle = WindowStyle.None;
                this.ResizeMode = ResizeMode.NoResize;

                await Task.Delay(200);

                // Verify video file exists before setting source
                string videoPath = System.IO.Path.Combine(Directory.GetCurrentDirectory(), "Assets", "a.mp4");
                if (!File.Exists(videoPath))
                {
                    throw new FileNotFoundException("Intro video not found", videoPath);
                }

                IntroVideo.Source = new Uri(videoPath, UriKind.Absolute);
                IntroVideo.Visibility = Visibility.Visible;
                IntroVideo.Opacity = 0;

                await Dispatcher.InvokeAsync(() => { }, DispatcherPriority.Loaded);

                await Task.Delay(200);

                // Fade in video
                await FadeAsync(IntroVideo, 0, 1, 1.5);

                // Play video safely
                IntroVideo.Play();

                // Wait for media to end with timeout
                var completionSource = new TaskCompletionSource<bool>();
                IntroVideo.MediaEnded += (s, _) => completionSource.TrySetResult(true);

                // Add timeout in case media never ends
                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(30));
                var completedTask = await Task.WhenAny(completionSource.Task, timeoutTask);

                // Fade out video
                await FadeAsync(IntroVideo, 1, 0, 1.5);
                await Task.Delay(1000);

                // Fade out window
                await FadeAsync(this, 1, 0, 0.6);
                await Task.Delay(300);

                // Safely transition to main window
                if (!_isClosing)
                {
                    var main = new MainWindow
                    {
                        Opacity = 0,
                        WindowState = WindowState.Maximized
                    };
                    main.Show();
                    await FadeAsync(main, 0, 1, 0.6);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Initialization failed: {ex.Message}");
                // Fallback to main window
                new MainWindow().Show();
            }
            finally
            {
                // Clean up media resources
                IntroVideo.Stop();
                IntroVideo.Source = null;
                this.Close();
            }
        }

        protected override void OnClosed(EventArgs e)
        {
            _isClosing = true;
            base.OnClosed(e);
        }

        private void IntroVideo_MediaFailed(object sender, ExceptionRoutedEventArgs e)
        {
            MessageBox.Show($"Video failed: {e.ErrorException.Message}");
            // Skip video and proceed to main window
            this.Opacity = 0;
            new MainWindow().Show();
            this.Close();
        }

        private static Task FadeAsync(UIElement element, double from, double to, double seconds)
        {
            var tcs = new TaskCompletionSource<bool>();
            var anim = new DoubleAnimation(from, to, TimeSpan.FromSeconds(seconds))
            {
                FillBehavior = FillBehavior.Stop
            };
            anim.Completed += (_, __) =>
            {
                element.Opacity = to;
                tcs.SetResult(true);
            };
            element.BeginAnimation(UIElement.OpacityProperty, anim);
            return tcs.Task;
        }

    }
}
