using System;
using System.ComponentModel;
using System.Windows.Media.Imaging;

namespace kpsk.Models
{
    public class ProductModel : INotifyPropertyChanged
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public double Price { get; set; }

        private string _imagePath;

        public string ImagePath
        {
            get => _imagePath;
            set
            {
                _imagePath = value;
                Image = LoadImage(value);
                OnPropertyChanged(nameof(Image));
            }
        }
        private BitmapImage _image;
        public BitmapImage Image
        {
            get => _image;
            set
            {
                _image = value;
                OnPropertyChanged(nameof(Image));
            }
        }

        private bool _isBought;
        public bool IsBought
        {
            get => _isBought;
            set
            {
                _isBought = value;
                OnPropertyChanged(nameof(IsBought));
                OnPropertyChanged(nameof(BuyButtonText));
            }
        }

        public string BuyButtonText => IsBought ? "Bought ✓" : $"Buy ${Price}";

        private BitmapImage LoadImage(string path)
        {
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.UriSource = new Uri($"pack://application:,,,/{path}");
                bitmap.EndInit();
                return bitmap;
            }
            catch
            {
                return new BitmapImage(new Uri("pack://application:,,,/Assets/asa.jpg"));
            }
        }
        public void Refresh()
        {
            OnPropertyChanged(nameof(IsBought));
            OnPropertyChanged(nameof(BuyButtonText));
        }
        public event PropertyChangedEventHandler PropertyChanged;

        protected virtual void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}