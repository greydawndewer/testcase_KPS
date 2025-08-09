using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;

namespace kpsk
{
    public static class DataService
    {
        private const string FilePath = "userdata.json";
        private static UserData _userData;

        public static UserData UserData
        {
            get
            {
                if (_userData == null)
                    LoadUserData();
                return _userData;
            }
        }

        public static void LoadUserData()
        {
            if (!File.Exists(FilePath))
            {
                _userData = new UserData();
                return;
            }

            var json = File.ReadAllText(FilePath);
            _userData = JsonConvert.DeserializeObject<UserData>(json) ?? new UserData();
        }

        public static void SaveUserData()
        {
            var json = JsonConvert.SerializeObject(_userData);
            File.WriteAllText(FilePath, json);
        }
    }
}