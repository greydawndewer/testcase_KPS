using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Media.Imaging;

namespace kpsk.Models
{
    public class VideoModel
    {
        public string Name { get; set; }
        public string Path { get; set; }
        public string Level { get; set; }

        // Store both the path and the image
        public string ThumbPath { get; set; }
        public BitmapImage Thumb { get; set; }
    }
}
